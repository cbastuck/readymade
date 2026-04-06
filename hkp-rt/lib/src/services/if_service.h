#pragma once

#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../sub_runtime.h"
#include "../uuid.h"

/**
 * Service Documentation
 * Service ID: if
 * Service Name: If
 * Runtime: hkp-rt
 *
 * Conditional branch service.  Evaluates a JSON structural pattern against
 * the incoming data.  If the pattern matches, the nested sub-pipeline runs
 * and its result is early-returned from the outer pipeline (downstream outer
 * services are skipped).  If the pattern does not match, the data is passed
 * through to the next service in the outer pipeline unchanged.
 *
 * State shape:
 *   {
 *     "condition": { ... },   // JSON subset pattern (see below)
 *     "pipeline": [           // sub-services run when condition is true
 *       { "serviceId": "...", "instanceId": "...", "state": { ... } }
 *     ]
 *   }
 *
 * Condition matching — structural subset (AND semantics):
 *   Every key-value pair in `condition` must be present with the same value
 *   in the incoming data.  Nested objects are matched recursively.
 *   For MixedData the condition is checked against meta; for plain JSON it is
 *   checked against the JSON directly.
 *
 *   Examples:
 *     { "method": "GET" }            — matches when meta.method == "GET"
 *     { "method": "POST", "path": "/upload" } — both must match (AND)
 *
 * configure() recognises:
 *   Full pipeline replacement:
 *     { "condition": {...}, "pipeline": [{...}, ...] }
 *   Append one service:
 *     { "appendService": { "serviceId": "...", "state"?: {...} } }
 *   Remove one service by instanceId:
 *     { "removeService": "<instanceId>" }
 */
namespace hkp {

class IfService : public Service
{
public:
  static std::string serviceId() { return "if"; }

  explicit IfService(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    Service::configure(data); // handle bypass

    auto j = getJSONFromData(data);
    if (!j)
      return getState();

    if (j->contains("condition") && (*j)["condition"].is_object())
      m_condition = (*j)["condition"];

    if (j->contains("pipeline") && (*j)["pipeline"].is_array())
    {
      m_pipelineConfig.clear();
      for (const auto& cfg : (*j)["pipeline"])
        m_pipelineConfig.push_back(cfg);
      rebuild();
    }
    else if (j->contains("appendService") && (*j)["appendService"].is_object())
    {
      auto svcCfg = (*j)["appendService"];
      if (!svcCfg.contains("instanceId") || svcCfg["instanceId"].get<std::string>().empty())
        svcCfg["instanceId"] = generateUUID();
      syncStates();
      m_pipelineConfig.push_back(std::move(svcCfg));
      rebuild();
    }
    else if (j->contains("removeService") && (*j)["removeService"].is_string())
    {
      const std::string id = (*j)["removeService"].get<std::string>();
      syncStates();
      m_pipelineConfig.erase(
        std::remove_if(m_pipelineConfig.begin(), m_pipelineConfig.end(),
          [&id](const json& cfg){ return cfg.value("instanceId", "") == id; }),
        m_pipelineConfig.end()
      );
      rebuild();
    }

    return getState();
  }

  json getState() const override
  {
    json pipeline = json::array();
    if (m_pipeline)
    {
      for (auto it = m_pipeline->begin(); it != m_pipeline->end(); ++it)
      {
        const auto& svc = *it;
        pipeline.push_back(json{
          {"serviceId",  svc->getServiceId()},
          {"instanceId", svc->getId()},
          {"state",      svc->getState()}
        });
      }
    }
    return mergeStateWith({{"condition", m_condition}, {"pipeline", pipeline}});
  }

  Data process(Data data) override
  {
    if (!matchesCondition(data))
      return data; // condition false: outer pipeline continues normally

    // Condition true: run sub-pipeline and early-return its result.
    // makeEarlyReturn stops the outer pipeline loop so downstream outer
    // services (e.g. filesystem) are never called.
    if (!m_pipeline || m_pipeline->empty())
      return makeEarlyReturn(data);

    return makeEarlyReturn(m_pipeline->process(data));
  }

protected:
  bool supportsSubservices() const override { return true; }

private:
  // Returns true iff every key-value pair in `pattern` is present with the
  // same value in `subject`.  Nested objects are matched recursively.
  static bool subsetMatch(const json& subject, const json& pattern)
  {
    for (const auto& [key, patternValue] : pattern.items())
    {
      if (!subject.contains(key))
        return false;
      const auto& subjectValue = subject[key];
      if (patternValue.is_object() && subjectValue.is_object())
      {
        if (!subsetMatch(subjectValue, patternValue))
          return false;
      }
      else if (subjectValue != patternValue)
      {
        return false;
      }
    }
    return true;
  }

  bool matchesCondition(const Data& data) const
  {
    if (m_condition.is_null() || !m_condition.is_object() || m_condition.empty())
      return false;

    // MixedData: match against meta
    if (auto mixed = getMixedDataFromData(data))
      return subsetMatch(mixed->meta, m_condition);

    // Plain JSON: match directly
    if (auto j = getJSONFromData(data))
      return subsetMatch(*j, m_condition);

    return false;
  }

  void syncStates()
  {
    if (!m_pipeline)
      return;
    for (auto it = m_pipeline->begin(); it != m_pipeline->end(); ++it)
    {
      const auto& svc = *it;
      for (auto& cfg : m_pipelineConfig)
      {
        if (cfg.value("instanceId", "") == svc->getId())
        {
          cfg["state"] = svc->getState();
          break;
        }
      }
    }
  }

  void rebuild()
  {
    json arr = json::array();
    for (const auto& cfg : m_pipelineConfig)
      arr.push_back(cfg);
    m_pipeline = createSubRuntime(arr);
  }

  json                        m_condition = json::object();
  std::shared_ptr<SubRuntime> m_pipeline;
  std::vector<json>           m_pipelineConfig;
};

} // namespace hkp
