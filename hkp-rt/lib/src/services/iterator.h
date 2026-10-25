#pragma once

#include <exception>
#include <string>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sub_service.h"

/**
 * Service Documentation
 * Service ID: iterator
 * Service Name: Iterator
 * Runtime: hkp-rt
 * Modes: one pass of the nested pipeline per item
 * Key Config: itemsFrom, limit, pipeline, bypass
 * IO: in=an array, or a single item -> out=the results, or nothing at all
 * Arrays: the point of the service
 * Binary: a non-JSON input is one item, handed to the nested pipeline untouched
 * MixedData: as binary
 */
namespace hkp {

// Iterator — iteration as a service, so a board can express it without a
// service having to grow its own loop.
//
// A pipeline pass carries one value, which is a problem for anything that
// produces several: a transcription's segments, a query's rows. Iterator runs
// its nested pipeline once per item and collects the answers, so iterating is
// a service you can see in the board rather than a loop buried in whichever
// service happened to need it first.
//
// **A single item is an array of one**, so a board that grows from one value to
// several does not change shape. An input that is not JSON — audio, bytes — is
// one item, handed over untouched.
//
// What the nested pipeline returns for an item is collected, and an item whose
// pipeline **stopped** contributes nothing — so a filter-shaped sub-pipeline
// makes this a filter. Nothing collected at all stops the outer pipeline here.
//
// **What an item answers with is collected as JSON**, as a Tracks branch's is:
// there is no Data type for a list of Data. An item answering with audio or raw
// bytes therefore contributes nothing, exactly as one that stopped does; a
// board iterating over audio ends the nested pipeline in what it feeds.
//
// **One item failing does not end the loop.** Failures are counted, logged and
// reported rather than thrown.
//
// Everything about the pipeline itself is a SubService's, which is what this
// is: the same scope, entered once per item rather than once.
//
// Matches `iterator` in hkp-node, hkp-python and the browser runtime.
class Iterator : public SubService
{
public:
  static std::string serviceId() { return "iterator"; }

  explicit Iterator(const std::string& instanceId)
    : SubService(instanceId, "iterator")
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    // The pipeline, bypass and the editing commands belong to the base.
    SubService::configure(data);

    auto j = getJSONFromData(data);
    if (j)
    {
      if (j->contains("itemsFrom") && (*j)["itemsFrom"].is_string())
        m_itemsFrom = (*j)["itemsFrom"].get<std::string>();
      if (j->contains("limit") && (*j)["limit"].is_number() && (*j)["limit"].get<double>() >= 0)
        m_limit = static_cast<size_t>((*j)["limit"].get<double>());
    }
    return getState();
  }

  json getState() const override
  {
    auto state = SubService::getState();
    state.update(json{
      {"itemsFrom",  m_itemsFrom},
      {"limit",      m_limit},
      {"lastItems",  m_lastItems},
      {"lastFailed", m_lastFailed},
    });
    return state;
  }

  Data process(Data data) override
  {
    const auto& nested = pipeline();
    if (!nested || nested->empty())
    {
      // Nothing to run the items through: what an empty SubService does.
      return stopsPropagation() ? Data(Null()) : data;
    }

    const auto items = itemsOf(data);
    json results = json::array();
    size_t failed = 0;

    for (const auto& item : items)
    {
      try
      {
        auto answer = nested->process(item);
        if (isNull(answer) || isUndefined(answer))
          continue;
        if (auto j = getJSONFromData(answer))
          results.push_back(*j);
        else if (auto str = getStringFromData(answer))
          results.push_back(*str);
      }
      catch (const std::exception& error)
      {
        ++failed;
        log(LogLevel::Error, "service.failed",
            json{{"message", std::string("iterator item failed: ") + error.what()}});
      }
    }

    m_lastItems = items.size();
    m_lastFailed = failed;
    sendNotification(json{
      {"items",   items.size()},
      {"results", results.size()},
      {"failed",  failed},
    });

    if (stopsPropagation() || results.empty())
      return Null();
    return results;
  }

  // The value at a dotted path, or null where the path does not lead.
  static json valueAt(const json& input, const std::string& path)
  {
    const json* current = &input;
    size_t start = 0;
    while (start <= path.size())
    {
      const auto end = path.find('.', start);
      const auto step = path.substr(start, end == std::string::npos ? std::string::npos : end - start);
      if (!current->is_object() || !current->contains(step))
        return nullptr;
      current = &(*current)[step];
      if (end == std::string::npos)
        break;
      start = end + 1;
    }
    return *current;
  }

private:
  // What to iterate over. `itemsFrom` reaches into a result that says more than
  // the list itself — `{ rows, count }` rather than a bare array.
  std::vector<Data> itemsOf(const Data& data) const
  {
    std::vector<Data> items;
    auto j = getJSONFromData(data);
    if (!j)
    {
      // Not JSON: one item as it is, unless a path was asked for, which only
      // JSON can answer.
      if (m_itemsFrom.empty() && !isNull(data) && !isUndefined(data))
        items.push_back(data);
      return items;
    }

    const json source = m_itemsFrom.empty() ? *j : valueAt(*j, m_itemsFrom);
    if (source.is_null())
      return items;
    if (source.is_array())
    {
      for (const auto& element : source)
      {
        if (m_limit > 0 && items.size() >= m_limit)
          break;
        items.push_back(element);
      }
    }
    else
    {
      items.push_back(source);
    }
    return items;
  }

  std::string m_itemsFrom;
  size_t      m_limit = 0;
  size_t      m_lastItems = 0;
  size_t      m_lastFailed = 0;
};

} // namespace hkp
