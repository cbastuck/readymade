#include "./models.h"

json jsonSerialise(const RuntimeConfiguration& conf)
{
  json j;
  j["id"] = conf.runtimeId;
  j["name"] = conf.runtimeName;
  json services = json::array();
  for (auto& svc : conf.services)
  {
    json service;
    service["serviceId"] = svc.serviceId;
    service["serviceName"] = svc.instanceName.empty() ? svc.serviceId : svc.instanceName;
    service["uuid"] = svc.instanceId;
    service["state"] = svc.state;
    services.push_back(service);
  }
  j["services"] = services;
  if (!conf.outputUrl.empty())
  {
    j["outputUrl"] = conf.outputUrl;
  }
  
  return j;
}