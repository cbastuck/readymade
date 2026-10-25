#pragma once

#include <chrono>
#include <cstdint>
#include <map>
#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sub_service.h"

/**
 * Service Documentation
 * Service ID: gather
 * Service Name: Gather
 * Runtime: hkp-rt
 * Modes: none — the items as an array, or what the nested pipeline makes of them
 * Key Config: pipeline, maxBytes, timeoutMs, bypass
 * IO: in=one part a Spread sent on -> out=the whole group, once every part is in; null until then
 * Arrays: what a group becomes, in the order it was spread
 * Binary: not a part, so passed through untouched
 * MixedData: as binary
 */
namespace hkp {

// Gather — the other half of Spread: waits until it has seen every part of a
// group and turns them back into one value.
//
// **A part says which whole it belongs to**: `{ item, group, index, total }`.
// Parts may arrive in any order and a part sent twice counts once. Until a group
// is complete nothing is passed on. Anything that is not a part passes through,
// so the same Gather sits on a board that sometimes sends a value whole.
//
// **What the group becomes is a pipeline, not a list of strategies** — the same
// answer Tracks gives its reducer. With none the items travel on as an array;
// with one, the pipeline is given `{ group, items }` and its answer goes on.
//
// **Collecting a group holds it in memory.** `maxBytes` bounds one group, and a
// group still incomplete after `timeoutMs` is let go — checked whenever a part
// arrives. Both are logged and reported as `error`, because a group that never
// arrives looks, from outside, exactly like nothing having been sent.
//
// Matches `gather` in hkp-node, hkp-python and the browser runtime.
class Gather : public SubService
{
public:
  static std::string serviceId() { return "gather"; }

  explicit Gather(const std::string& instanceId)
    : SubService(instanceId, "gather")
  {}

  std::string getServiceId() const override { return serviceId(); }

  // Whether a value is a part a Spread sent on, rather than one to pass through.
  static bool isPart(const json& value)
  {
    if (!value.is_object() || !value.contains("item"))
      return false;
    const auto group = value.find("group");
    const auto index = value.find("index");
    const auto total = value.find("total");
    if (group == value.end() || !group->is_string() || group->get<std::string>().empty())
      return false;
    if (index == value.end() || !index->is_number_integer() || index->get<int64_t>() < 0)
      return false;
    if (total == value.end() || !total->is_number_integer() || total->get<int64_t>() <= 0)
      return false;
    return index->get<int64_t>() < total->get<int64_t>();
  }

  json configure(Data data) override
  {
    // The pipeline, bypass and the editing commands belong to the base.
    SubService::configure(data);

    auto j = getJSONFromData(data);
    if (j)
    {
      if (j->contains("maxBytes") && (*j)["maxBytes"].is_number() && (*j)["maxBytes"].get<double>() > 0)
        m_maxBytes = static_cast<uint64_t>((*j)["maxBytes"].get<double>());
      if (j->contains("timeoutMs") && (*j)["timeoutMs"].is_number() && (*j)["timeoutMs"].get<double>() > 0)
        m_timeoutMs = static_cast<int64_t>((*j)["timeoutMs"].get<double>());
    }
    return getState();
  }

  json getState() const override
  {
    auto state = SubService::getState();
    state.update(json{
      {"maxBytes",  m_maxBytes},
      {"timeoutMs", m_timeoutMs},
      {"pending",   m_collecting.size()},
      {"error",     m_lastError},
    });
    return state;
  }

  Data process(Data data) override
  {
    auto j = getJSONFromData(data);
    if (!j || !isPart(*j))
      return data;

    const auto now = Clock::now();
    letGoOfStale(now);

    const auto group = (*j)["group"].get<std::string>();
    const auto index = (*j)["index"].get<int64_t>();
    const auto total = (*j)["total"].get<int64_t>();
    const auto& item = (*j)["item"];
    if (m_refused.count(group))
      return Null();

    auto found = m_collecting.find(group);
    if (found == m_collecting.end())
      found = m_collecting.emplace(group, Collecting{{}, total, 0, now}).first;
    auto& collecting = found->second;

    if (collecting.total != total)
    {
      refuse(group, now, "group " + group + " said " + std::to_string(collecting.total) +
                         " parts, then " + std::to_string(total));
      return Null();
    }
    if (collecting.items.count(index))
      return Null(); // Sent twice; the first one counts.

    collecting.bytes += sizeOf(item);
    if (collecting.bytes > m_maxBytes)
    {
      refuse(group, now, "group " + group + " is larger than " +
                         std::to_string(m_maxBytes) + " bytes");
      return Null();
    }

    collecting.items.emplace(index, item);
    const auto received = collecting.items.size();
    sendNotification(json{
      {"group",    group},
      {"received", received},
      {"total",    total},
      {"pending",  m_collecting.size()},
    });

    if (static_cast<int64_t>(received) < total)
      return Null();

    json items = json::array();
    for (auto& [_, value] : collecting.items)
      items.push_back(std::move(value));
    m_collecting.erase(found);

    const auto& nested = pipeline();
    if (!nested || nested->empty())
      return stopsPropagation() ? Data(Null()) : Data(items);
    auto result = nested->process(json{{"group", group}, {"items", std::move(items)}});
    return stopsPropagation() ? Data(Null()) : result;
  }

private:
  using Clock = std::chrono::steady_clock;

  struct Collecting
  {
    // By index, ordered: what the group becomes is read off in order. A map
    // rather than a vector of `total` because a part names its own total, and
    // that much would be allocated before a second part had arrived.
    std::map<int64_t, json> items;
    int64_t total = 0;
    uint64_t bytes = 0;
    Clock::time_point startedAt;
  };

  // What a part costs to hold, near enough to bound memory by.
  static uint64_t sizeOf(const json& item)
  {
    if (item.is_string())
      return item.get_ref<const std::string&>().size();
    if (item.is_null())
      return 0;
    return item.dump().size();
  }

  bool expired(Clock::time_point since, Clock::time_point now) const
  {
    return std::chrono::duration_cast<std::chrono::milliseconds>(now - since).count() > m_timeoutMs;
  }

  void refuse(const std::string& group, Clock::time_point now, const std::string& message)
  {
    m_collecting.erase(group);
    m_refused[group] = now;
    m_lastError = message;
    log(LogLevel::Error, "gather.refused", json{{"group", group}, {"message", message}});
    sendNotification(json{{"error", message}, {"pending", m_collecting.size()}});
  }

  // Lets go of groups that stopped arriving, and of refusals that are old.
  void letGoOfStale(Clock::time_point now)
  {
    for (auto it = m_collecting.begin(); it != m_collecting.end();)
    {
      if (!expired(it->second.startedAt, now))
      {
        ++it;
        continue;
      }
      const auto group = it->first;
      const auto received = it->second.items.size();
      const auto total = it->second.total;
      it = m_collecting.erase(it);
      m_lastError = "group " + group + " timed out with " + std::to_string(received) +
                    " of " + std::to_string(total) + " parts";
      log(LogLevel::Warn, "gather.timed-out",
          json{{"group", group}, {"received", received}, {"total", total}});
      sendNotification(json{{"error", m_lastError}, {"pending", m_collecting.size()}});
    }
    for (auto it = m_refused.begin(); it != m_refused.end();)
      it = expired(it->second, now) ? m_refused.erase(it) : std::next(it);
  }

  // As much as the coordinator lets through in one frame by default.
  uint64_t m_maxBytes = 64ull * 1024 * 1024;
  int64_t  m_timeoutMs = 60000;
  std::string m_lastError;
  std::map<std::string, Collecting> m_collecting;
  // Groups given up on, and when. The parts of a group still on their way when
  // it was refused would otherwise start it again.
  std::map<std::string, Clock::time_point> m_refused;
};

} // namespace hkp
