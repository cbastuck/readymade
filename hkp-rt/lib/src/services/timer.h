#pragma once

#include <chrono>
#include <iostream>
#include <optional>
#include <string>
#include <thread>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include <boost/asio.hpp>
#include <boost/asio/deadline_timer.hpp>

namespace hkp {

class Timer : public Service
{
public:
  static std::string serviceId() { return "timer"; }

  Timer(const std::string& instanceId)
    : Service(instanceId, serviceId())
    , io_context_()
    , timer_(io_context_)
  {}

  ~Timer()
  {
    silentStop();
  }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j)
    {
      bool doStop = j->value("stop", false)
                 || j->value("restart", false)
                 || (m_running && j->contains("running") && !(*j)["running"].get<bool>());
      bool doStart = j->value("start", false) || j->value("restart", false);
      bool immediate = j->value("immediate", false);

      if (j->contains("periodicValue"))
      {
        m_periodicValue = (*j)["periodicValue"];
        sendNotification(json{{"periodicValue", m_periodicValue}});
        if (m_running && !doStart) { silentStop(); doStart = true; }
      }

      if (j->contains("periodicUnit"))
      {
        m_periodicUnit = (*j)["periodicUnit"].get<std::string>();
        sendNotification(json{{"periodicUnit", m_periodicUnit}});
        if (m_running && !doStart) { silentStop(); doStart = true; }
      }

      if (j->contains("periodic"))
      {
        m_periodic = (*j)["periodic"];
        sendNotification(json{{"periodic", m_periodic}});
      }

      if (j->contains("oneShotDelay"))
      {
        m_oneShotDelay = (*j)["oneShotDelay"];
        sendNotification(json{{"oneShotDelay", m_oneShotDelay}, {"periodic", false}});
      }

      if (j->contains("oneShotDelayUnit"))
      {
        m_oneShotDelayUnit = (*j)["oneShotDelayUnit"].get<std::string>();
        sendNotification(json{{"oneShotDelayUnit", m_oneShotDelayUnit}});
      }

      if (j->contains("counter"))
      {
        m_counter = (*j)["counter"];
      }

      if (j->contains("until") && (*j)["until"].contains("triggerCount"))
      {
        m_conditionUntilTriggerCount = (*j)["until"]["triggerCount"].get<int>();
      }

      if (doStop) fullStop();
      if (doStart) startTimer(immediate);
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override { return serviceId(); }

  json getState() const override
  {
    auto state = Service::getState();
    state.update(json{
      {"periodic",        m_periodic},
      {"periodicValue",   m_periodicValue},
      {"periodicUnit",    m_periodicUnit},
      {"oneShotDelay",    m_oneShotDelay},
      {"oneShotDelayUnit", m_oneShotDelayUnit},
      {"running",         m_running},
      {"counter",         m_counter},
    });
    return mergeBypassState(state);
  }

  Data process(Data data) override
  {
    // Periodic timers drive themselves — passthrough.
    // One-shot triggered via process(): schedule a delayed fire and return immediately.
    if (!m_periodic)
    {
      const auto delayUs = durationMicroseconds(m_oneShotDelay, m_oneShotDelayUnit);
      std::thread([this, delayUs]() {
        std::this_thread::sleep_for(std::chrono::microseconds(delayUs));
        onTick();
      }).detach();
    }
    return data;
  }

  bool onBypassChanged(bool bypass) override
  {
    if (bypass) 
    {
      fullStop();
    }
    else        startTimer(false);
    return bypass;
  }

private:
  // ── Duration helper ──────────────────────────────────────────────────────

  static uint64_t durationMicroseconds(int value, const std::string& unit)
  {
    if (unit == "ms") return static_cast<uint64_t>(value) * 1'000ULL;
    if (unit == "s")  return static_cast<uint64_t>(value) * 1'000'000ULL;
    if (unit == "m")  return static_cast<uint64_t>(value) * 60'000'000ULL;
    if (unit == "h")  return static_cast<uint64_t>(value) * 3'600'000'000ULL;
    if (unit == "d")  return static_cast<uint64_t>(value) * 86'400'000'000ULL;
    return static_cast<uint64_t>(value) * 1'000'000ULL; // fallback: treat as seconds
  }

  // ── Timer lifecycle ──────────────────────────────────────────────────────

  // Stop the io_context and join the thread without sending any notifications.
  // Safe to call even if not running. Used for silent restart and in destructor.
  void silentStop()
  {
    timer_.cancel();
    io_context_.stop();
    if (io_service_thread_.joinable())
    {
      io_service_thread_.join();
    }
  }

  // Full stop: resets counter to 0 and broadcasts running=false.
  void fullStop()
  {
    silentStop();
    m_counter = 0;
    m_running = false;
    sendNotification(json{{"running", false}, {"count", m_counter}});
  }

  void startTimer(bool immediate)
  {
    silentStop();
    io_context_.restart();

    const uint64_t delayUs = immediate ? 1ULL
      : (m_periodic
          ? durationMicroseconds(m_periodicValue, m_periodicUnit)
          : durationMicroseconds(m_oneShotDelay, m_oneShotDelayUnit));

    scheduleNext(delayUs);
    io_service_thread_ = std::thread([this]() { io_context_.run(); });
    m_running = true;
    sendNotification(json{{"running", true}});
  }

  void scheduleNext(uint64_t delayUs)
  {
    timer_.expires_from_now(boost::posix_time::microseconds(static_cast<long>(delayUs)));
    timer_.async_wait([this](const boost::system::error_code& ec) {
      if (!ec) onTick();
    });
  }

  // ── Tick logic (runs on io_service_thread_) ──────────────────────────────

  void onTick()
  {
    if (m_conditionUntilTriggerCount.has_value() && m_counter >= *m_conditionUntilTriggerCount)
    {
      m_counter = 0;
      m_running = false;
      sendNotification(json{{"running", false}, {"count", 0}});
      return; // no reschedule — io_context drains and thread exits naturally
    }

    const int triggerCount = ++m_counter;
    const auto triggerData = json{{"triggerCount", triggerCount}};

    sendNotification(json{{"counter", triggerCount}});

    // Signal the process indicators in ServiceFrame (same pattern as http-server service).
    // call-process-finished is sent immediately after posting the async work because
    // the timer is the initiator — it doesn't receive a result back.
    sendNotification(json{{"__internal", {{"state", "call-process"}, {"data", triggerData}}}});
    nextAsync(triggerData); // thread-safe: posts to App io_context
    sendNotification(json{{"__internal", {{"state", "call-process-finished"}, {"data", triggerData}}}});

    if (m_periodic)
    {
      scheduleNext(durationMicroseconds(m_periodicValue, m_periodicUnit));
    }
    else
    {
      m_running = false;
      sendNotification(json{{"running", false}});
      // no reschedule — one-shot complete
    }
  }

  // ── State ────────────────────────────────────────────────────────────────

  boost::asio::io_context    io_context_;
  boost::asio::deadline_timer timer_;
  std::thread                io_service_thread_;

  bool        m_periodic         = false;
  int         m_periodicValue    = 1;
  std::string m_periodicUnit     = "s";
  int         m_oneShotDelay     = 0;
  std::string m_oneShotDelayUnit = "ms";
  bool        m_running          = false;
  int         m_counter          = 0;
  std::optional<int> m_conditionUntilTriggerCount;
};

} // namespace hkp
