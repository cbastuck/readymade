#include <types/models.h>

namespace hkp {

json jsonSerialise(const RuntimeConfiguration& conf)
{
  json j;
  j["id"] = conf.runtimeId;
  j["name"] = conf.runtimeName;
  j["boardName"] = conf.boardName;
  json services = json::array();
  for (auto& svc : conf.services)
  {
    json service;
    service["serviceId"] = svc.serviceId;
    service["serviceName"] = svc.instanceName.empty() ? svc.serviceId : svc.instanceName;
    service["uuid"] = svc.instanceId;
    service["capabilities"] = svc.capabilities;
    service["state"] = svc.state;
    services.push_back(service);
  }
  j["services"] = services;
  if (!conf.outputUrl.empty())
  {
    j["outputUrl"] = conf.outputUrl;
  }
  auto inputs = j["inputs"] = json::array();
  for (auto& input : conf.inputs)
  {
    inputs.push_back(jsonSerialise(input));
  }
  
  return j;
}

json jsonSerialise(const RuntimeInput& input)
{
  json j;
  j["id"] = input.id;
  j["url"] = input.url;
  j["type"] = runtimeTypeAsString(input.type);
  j["runtimeId"] = input.runtimeId;
  j["runtimeUrl"] = input.runtimeUrl;
  j["serviceId"] = input.serviceId;
  return j;
}

std::string runtimeTypeAsString(RuntimeInput::Type t)
{
  switch (t)
  {
    case RuntimeInput::PROCESS:
      return "process";
    case RuntimeInput::CONFIGURE:
      return "configure";
    case RuntimeInput::EXTERNAL:
      return "external";
  }
  return "unknown";
}

RuntimeInput::Type parseRuntimeType(const std::string& t)
{
  if (t == "process")
  {
    return RuntimeInput::PROCESS;
  }
  if (t == "configure")
  {
    return RuntimeInput::CONFIGURE;
  }
  if (t == "external")
  {
    return RuntimeInput::EXTERNAL;
  }
  throw std::runtime_error("Unknown runtime type: " + t);
}

}