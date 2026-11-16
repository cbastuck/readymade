#pragma once

#include <atomic>
#include <exception>
#include <memory>
#include <optional>
#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../common/expression.h"
#include "../process_context.h"
#include "./sub_service.h"

/**
 * Service Documentation
 * Service ID: loop
 * Service Name: Loop
 * Runtime: hkp-rt
 * Modes: run (rounds until done), step (one round per call)
 * Key Config: until, maxRounds, mode, pipeline, bypass; commands stop, reset
 * IO: in=the value to start from, or nothing to carry on -> out=the last round's output
 * Arrays: passed to the nested pipeline as one value
 * Binary: passed to the nested pipeline untouched
 * MixedData: passed to the nested pipeline untouched
 */
namespace hkp {

// Loop — repetition as a service: a pipeline run again on its own output.
//
// Iterator runs one pipeline over many items. Loop runs one pipeline over one
// value, many times: what a round returns is what the next round is given,
// until a condition on that value holds or a limit of rounds is reached.
// Generating text is the case it was built for — each round appends one token
// — but nothing here knows about tokens.
//
// **A value starts a loop, nothing carries one on.** A call with a value
// begins at round one with it. A call with nothing continues from the value
// the loop holds, which is how a Step button works: it calls the service and
// passes nothing.
//
// **Every round is reported** as `{ round, done, reason, output }`, so what a
// loop is building can be watched while it runs.
//
// **A run does not hold the pipeline thread.** That thread is the App's event
// loop, and in an app the UI's. `run` therefore answers its call at once with
// nothing and takes each round as an event of its own, handing on the last
// round's output with emit() when it is done — the arrangement
// text-generation uses for the same reason. Between two rounds everything
// else gets its turn, which is what lets `{ "stop": true }` arrive. `step` is
// one round, and answers its call with it.
//
// **Stop is a configure**, `{ "stop": true }`. The round in progress finishes
// and the loop keeps its value, so it can be carried on afterwards.
//
// **A round that fails ends the run**, and the loop keeps the value it had
// before that round. A step that fails throws, as any service does.
//
// The services inside answer their call themselves: one that defers its answer
// (emit() later) ends the round with nothing, and so the loop.
//
// Matches `loop` in hkp-python.
class Loop : public SubService
{
public:
  static std::string serviceId() { return "loop"; }

  explicit Loop(const std::string& instanceId)
    : SubService(instanceId, "loop")
  {}

  std::string getServiceId() const override { return serviceId(); }

  void shutdown() override
  {
    // Whatever round is still queued finds a generation that is not its own.
    ++m_generation;
    m_running = false;
  }

  json configure(Data data) override
  {
    // The pipeline, bypass and the editing commands belong to the base.
    SubService::configure(data);

    auto j = getJSONFromData(data);
    if (!j)
      return getState();

    if (j->contains("until") && (*j)["until"].is_string())
    {
      const auto source = (*j)["until"].get<std::string>();
      if (source.find_first_not_of(" \t\r\n") == std::string::npos)
      {
        m_until.reset();
      }
      else
      {
        try
        {
          m_until = expression::Expression::parse(source);
        }
        catch (const expression::ParseError& error)
        {
          throw std::runtime_error("loop: invalid expression '" + source + "': " + error.what());
        }
      }
      m_untilSource = source;
    }
    if (j->contains("maxRounds") && (*j)["maxRounds"].is_number() &&
        (*j)["maxRounds"].get<double>() >= 0)
      m_maxRounds = static_cast<size_t>((*j)["maxRounds"].get<double>());
    if (j->contains("mode") && (*j)["mode"].is_string())
    {
      const auto mode = (*j)["mode"].get<std::string>();
      if (mode == "run" || mode == "step")
        m_mode = mode;
    }
    if (j->value("stop", json(false)) == json(true))
      m_stop = true;
    if (j->value("reset", json(false)) == json(true))
    {
      ++m_generation;
      m_running = false;
      start(std::nullopt);
    }
    return getState();
  }

  json getState() const override
  {
    auto state = SubService::getState();
    state.update(json{
      {"until",     m_untilSource},
      {"maxRounds", m_maxRounds},
      {"mode",      m_mode},
      {"round",     m_round},
      {"running",   m_running},
      {"done",      m_done},
      {"reason",    m_reason},
    });
    return state;
  }

  Data process(Data data) override
  {
    const auto& nested = pipeline();
    if (!nested || nested->empty())
    {
      // Nothing to repeat: what an empty SubService does.
      return stopsPropagation() ? Data(Null()) : data;
    }

    // Nothing is Null, Undefined, or the JSON null a caller sends when it has
    // no payload — a facade button whose action names none.
    const auto asJson = getJSONFromData(data);
    const bool nothing = isNull(data) || isUndefined(data) || (asJson && asJson->is_null());
    if (!nothing)
      start(std::move(data));
    if (!m_held || m_done)
    {
      // Nothing to carry on from, or nothing left to do.
      return Null();
    }

    // A call made while a run is under way takes over from it.
    const auto generation = ++m_generation;
    m_stop = false;
    m_reason.clear();
    m_ranInCall = false;
    m_context.reset();
    if (auto* host = parentHost())
    {
      if (const auto* context = host->currentContext())
        m_context = std::make_shared<const ProcessContext>(*context);
    }

    if (m_mode == "step")
    {
      m_running = false;
      const bool ran = round();
      if (!ran)
        sendNotification(report(nullptr));
      return ran && !stopsPropagation() ? *m_held : Data(Null());
    }

    m_running = true;
    auto nothingYet = deferCompletion();
    scheduleRound(generation);
    return nothingYet;
  }

private:
  void start(std::optional<Data> value)
  {
    m_held = std::move(value);
    m_round = 0;
    m_done = false;
    m_reason.clear();
  }

  void finish(const std::string& reason)
  {
    m_done = true;
    m_reason = reason;
  }

  // One round. Answers whether it produced something for the next.
  bool round()
  {
    if (m_maxRounds && m_round >= m_maxRounds)
    {
      // Only reached when the limit was lowered under a loop already past it.
      finish("maxRounds");
      return false;
    }

    auto run = [this]() { return pipeline()->process(*m_held); };
    auto* host = parentHost();
    Data output = (host && m_context && !host->currentContext())
      ? host->withContext(*m_context, run)
      : run();

    if (isNull(output) || isUndefined(output))
    {
      // The pipeline stopped: there is nothing to give the next round, so
      // this is where the loop ends.
      finish("ended");
      return false;
    }

    m_held = output;
    ++m_round;
    m_ranInCall = true;

    json reported = nullptr;
    if (auto j = getJSONFromData(output))
      reported = *j;
    else if (auto text = getStringFromData(output))
      reported = *text;

    // A condition is over JSON; a value that is none cannot meet one.
    if (m_until && !reported.is_null() &&
        expression::isTruthy(m_until->evaluate(reported)))
      finish("until");
    else if (m_maxRounds && m_round >= m_maxRounds)
      finish("maxRounds");

    sendNotification(report(reported));
    return true;
  }

  json report(const json& output) const
  {
    json said{{"round", m_round}, {"done", m_done}, {"reason", m_reason}};
    if (!output.is_null())
      said["output"] = output;
    return said;
  }

  void scheduleRound(size_t generation)
  {
    auto* host = parentHost();
    if (!host)
      return;
    host->post([this, generation, alive = std::weak_ptr<int>(m_alive)]() {
      if (alive.expired() || generation != m_generation)
        return;
      runRound(generation);
    });
  }

  void runRound(size_t generation)
  {
    if (m_stop)
    {
      m_reason = "stopped";
      return endRun();
    }

    bool ran = false;
    try
    {
      ran = round();
    }
    catch (const std::exception& error)
    {
      m_reason = "failed";
      log(LogLevel::Error, "service.failed",
          json{{"message", std::string("loop round failed: ") + error.what()}});
      auto said = report(nullptr);
      said["error"] = error.what();
      sendNotification(said);
      m_running = false;
      // What earlier rounds produced is still held; nothing is handed on from
      // a run that failed.
      endDeferred();
      return;
    }

    if (!ran || m_done)
      return endRun();
    scheduleRound(generation);
  }

  // The run is over: hand on what it produced, or say that it produced nothing.
  void endRun()
  {
    m_running = false;
    if (m_ranInCall && !stopsPropagation())
    {
      emit(*m_held);
      return;
    }
    if (!m_ranInCall)
      sendNotification(report(nullptr));
    endDeferred();
  }

  std::string                           m_untilSource;
  std::optional<expression::Expression> m_until;
  size_t                                m_maxRounds = 100;
  std::string                           m_mode = "run";
  // What the next round is given. Empty: nothing to carry on from.
  std::optional<Data>                   m_held;
  size_t                                m_round = 0;
  bool                                  m_done = false;
  bool                                  m_running = false;
  bool                                  m_ranInCall = false;
  std::string                           m_reason;
  // Set from configure, which may arrive on another thread than the rounds.
  std::atomic<bool>                     m_stop{false};
  // Which call the queued rounds belong to: a later call, a reset or a
  // shutdown leaves the ones before it with nothing to do.
  std::atomic<size_t>                   m_generation{0};
  // The run the call was made in, for the rounds taken after it returned.
  std::shared_ptr<const ProcessContext> m_context;
  // Gone with the service, so a round queued behind its destruction is not run.
  std::shared_ptr<int>                  m_alive = std::make_shared<int>(0);
};

} // namespace hkp
