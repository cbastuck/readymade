#pragma once

#include <algorithm>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../address.h"
#include "../sub_runtime.h"
#include "../uuid.h"

/**
 * Service Documentation
 * Service ID: sub-service
 * Service Name: SubService
 * Runtime: hkp-rt
 * Modes: sub-pipeline execution
 * Key Config: pipeline/subservices configuration
 * IO: in=any -> out=pipeline result
 * Arrays: service-defined, typically forwarded
 * Binary: depends on nested services
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

// SubService — a concrete Service that hosts a configurable nested pipeline
// (SubRuntime).  The pipeline is expressed as a JSON array of service-config
// objects and can be extended or trimmed at runtime through configure().
//
// State shape (returned by getState / sent as notifications):
//   {
//     "bypass": false,
//     "pipeline": [
//       { "serviceId": "http-client", "instanceId": "...", "state": { ... } },
//       { "serviceId": "mp4-to-wav",  "instanceId": "...", "state": { ... } }
//     ]
//   }
//
// configure() accepts the following operations (mutually exclusive per call):
//
//   Full replacement  — rebuilds the whole pipeline:
//     { "pipeline": [ { "serviceId": "...", "state": { ... } }, ... ] }
//
//   Append one service:
//     { "appendService": { "serviceId": "...", "state"?: { ... } } }
//     An instanceId is generated automatically if not provided.
//
//   Remove one service by instanceId:
//     { "removeService": "<instanceId>" }
//
// data passes straight through the nested pipeline; the result of the last
// sub-service becomes the output of the SubService.
//
class SubService : public Service
{
public:
  static std::string serviceId() { return "sub-service"; }
  static std::vector<std::string> capabilities() { return {"subservices"}; }

  explicit SubService(const std::string& instanceId)
    : Service(instanceId, "sub-service")
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    Service::configure(data); // handle bypass

    auto j = getJSONFromData(data);
    if (!j)
      return getState();

    // Read only when it is a boolean, so a board that never mentions it keeps
    // the default rather than having one written over it by silence.
    if (j->contains("stopPropagation") && (*j)["stopPropagation"].is_boolean())
    {
      m_stopPropagation = (*j)["stopPropagation"].get<bool>();
      applyPipelineSettings();
    }
    if (j->contains("scope") && (*j)["scope"].is_object())
    {
      const auto& scope = (*j)["scope"];
      if (scope.contains("slots") && scope["slots"].is_string())
      {
        const auto slots = scope["slots"].get<std::string>();
        if (slots == "own" || slots == "inherit")
        {
          m_scopeSlots = slots;
          applyPipelineSettings();
        }
      }
    }

    if (j->contains("pipeline") && (*j)["pipeline"].is_array())
    {
      m_pipelineConfig.clear();
      for (const auto& cfg : (*j)["pipeline"])
        m_pipelineConfig.push_back(cfg);
      rebuild();
    }
    else if (j->contains("appendService"))
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
          [&id](const json& cfg) { return cfg.value("instanceId", "") == id; }),
        m_pipelineConfig.end()
      );
      rebuild();
    }
    else if (j->contains("configureService") && (*j)["configureService"].is_object())
    {
      const auto& cfg = (*j)["configureService"];
      if (cfg.contains("instanceId") && cfg.contains("state") && m_pipeline)
      {
        const std::string id = cfg["instanceId"].get<std::string>();
        for (auto it = m_pipeline->begin(); it != m_pipeline->end(); ++it)
        {
          if ((*it)->getId() == id)
          {
            (*it)->configure(cfg["state"]);
            syncStates();
            break;
          }
        }
      }
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
    return mergeStateWith({
      // Reported even when false, like the bypass beside it: a saved board
      // then says outright what each scope does with its answer, instead of
      // leaving a reader to infer a boundary from what follows it.
      {"stopPropagation", m_stopPropagation},
      {"scope", json{{"slots", m_scopeSlots}}},
      {"pipeline", pipeline},
    });
  }

  Data process(Data data) override
  {
    if (!m_pipeline || m_pipeline->empty())
    {
      // A scope that passes nothing on passes nothing on when there is nothing
      // to run either: what leaves this service is the board author's to say,
      // and it does not become the input again because the pipeline was empty.
      return m_stopPropagation ? Data(Null()) : data;
    }
    auto result = m_pipeline->process(data);
    return m_stopPropagation ? Data(Null()) : result;
  }

  // The nested service a scoped address names inside this one.
  //
  // What makes a sub-pipeline addressable from outside: without it the board
  // can reach this service but nothing it contains, so a facade could drive a
  // scope but not read what the scope is doing.
  std::shared_ptr<Service> findNested(const std::string& instanceId) const override
  {
    return m_pipeline ? m_pipeline->find(instanceId) : nullptr;
  }

  // Enters this service's pipeline at one of its services. The nested pipeline
  // is a chain like any other, so this is processAt one level down.
  bool processNested(const std::string& address, Data data, Data& result) override
  {
    if (!m_pipeline)
      return false;

    const auto segments = splitAddress(address);
    if (segments.empty())
      return false;

    auto svc = m_pipeline->find(segments[0]);
    if (!svc)
      return false;

    if (segments.size() > 1)
      return svc->processNested(restOfAddress(segments, 1), data, result);

    result = m_pipeline->processFrom(*svc, data, /*advanceBefore=*/false);
    return true;
  }

protected:
  bool supportsSubservices() const override { return true; }

private:
  // Flush live sub-service states back into m_pipelineConfig before a rebuild
  // so that reconfigured sub-services don't lose their settings.
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

  // Tear down the current SubRuntime and recreate it from m_pipelineConfig.
  void rebuild()
  {
    json arr = json::array();
    for (const auto& cfg : m_pipelineConfig)
      arr.push_back(cfg);
    m_pipeline = createSubRuntime(arr);
    applyPipelineSettings();
  }

  // What this scope keeps to itself, and what leaves it.
  //
  // Applied on every rebuild and on every change, because a SubRuntime is
  // replaced whenever the pipeline is edited and would otherwise come back
  // with the defaults rather than with what the board said.
  void applyPipelineSettings()
  {
    if (!m_pipeline)
      return;
    m_pipeline->setStopPropagation(m_stopPropagation);
    if (m_scopeSlots == "own")
      m_pipeline->shareSlots(m_slots);
  }

  std::shared_ptr<SubRuntime> m_pipeline;
  std::vector<json>           m_pipelineConfig;
  // Whether what this pipeline produced leaves this service. A scope that ends
  // here rather than feeding the services after it: the two flows on one
  // runtime that a Stopper between them used to mark by convention.
  bool                        m_stopPropagation = false;
  // What this scope keeps to itself: "own" | "inherit".
  std::string                 m_scopeSlots = "own";
  // The cells a scope of its own holds values in. Owned here rather than left
  // to the nested runtime so that rebuilding the pipeline — which a board does
  // on every edit to it — does not drop what is held across it.
  SlotStore                   m_slots;
};

} // namespace hkp
