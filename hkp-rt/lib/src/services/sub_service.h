#pragma once

#include <algorithm>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../sub_runtime.h"
#include "../uuid.h"

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
    return mergeStateWith({{"pipeline", pipeline}});
  }

  Data process(Data data) override
  {
    if (!m_pipeline || m_pipeline->empty())
      return data;
    return m_pipeline->process(data);
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
  }

  std::shared_ptr<SubRuntime> m_pipeline;
  std::vector<json>           m_pipelineConfig;
};

} // namespace hkp
