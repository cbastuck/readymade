#pragma once

#include <types/types.h>

namespace hkp {

inline std::optional<ServiceConfiguration> validateService(json config)
{
  ServiceConfiguration conf;
  auto serviceId = config.find("serviceId");
  if (serviceId == config.end())
  {
    return std::nullopt;
  }
  conf.serviceId = *serviceId;
  
  auto instanceId = config.find("uuid");
  if (instanceId == config.end())
  {
    return std::nullopt;
  }
  conf.instanceId = *instanceId;

  auto instanceName = config.find("name");
  
  conf.instanceName = instanceName != config.end() ? *instanceName : *serviceId;
  
  auto state = config.find("state");
  if (state != config.end())
  {
    if (!state->is_object())
    {
      return std::nullopt;
    }  
  }
  conf.state = state != config.end() ? *state : json::object();
  return std::optional<ServiceConfiguration>(conf);
}

inline std::optional<RuntimeInput> validateRuntimeInput(json config)
{
  if (!config.is_object())
  {
    return std::nullopt;
  }

  auto id = config.find("id");
  if (id == config.end())
  {
    return std::nullopt;
  }

  auto serviceId = config.find("serviceId");
  if (serviceId == config.end())
  {
    return std::nullopt;
  }

  auto type = config.find("type");
  if (type == config.end() || !type->is_string())
  {
    return std::nullopt;
  }

  return std::optional<RuntimeInput>(
    RuntimeInput {
      .id = *id,
      .serviceId = *serviceId,
      .type = parseRuntimeType(*type),
    }
  );
}

inline std::optional<RuntimeConfiguration> validateRuntime(json config)
{
  RuntimeConfiguration conf;
  if (!config.is_object())
  {
    return std::nullopt;
  }

  auto runtimeId = config.find("id");
  if (runtimeId == config.end())
  {
    return std::nullopt;
  }
  conf.runtimeId = *runtimeId;

  auto runtimeName = config.find("name");
  if (runtimeName == config.end())
  {
    return std::nullopt;
  }
  conf.runtimeName = *runtimeName;

  // Absent means persist; see RuntimeConfiguration::garbageCollected.
  auto garbageCollected = config.find("garbageCollected");
  conf.garbageCollected =
    garbageCollected != config.end() && garbageCollected->is_boolean() &&
    garbageCollected->get<bool>();

  // Absent means off; see RuntimeConfiguration::logData.
  auto state = config.find("state");
  if (state != config.end() && state->is_object())
  {
    auto logging = state->find("logging");
    conf.logging = logging != state->end() && logging->is_boolean() &&
                   logging->get<bool>();
    auto logLevel = state->find("logLevel");
    if (logLevel != state->end() && logLevel->is_string())
    {
      const auto level = logLevel->get<std::string>();
      if (level == "debug" || level == "info" || level == "warn" || level == "error")
        conf.logLevel = level;
    }
    // Absent means allowed; see RuntimeConfiguration::logData.
    auto logData = state->find("logData");
    conf.logData = !(logData != state->end() && logData->is_boolean() &&
                     !logData->get<bool>());
  }

  auto services = config.find("services");
  if (services == config.end())
  {
    return std::nullopt;
  }

  if (!services->is_array())
  {
    return std::nullopt;
  }

  for (auto &service : *services)
  {
    auto svc = validateService(service);
    if (!svc)
    {
      return std::nullopt;
    }
    conf.services.push_back(*svc);
  }

  auto inputs = config.find("inputs");
  if (inputs != config.end() && inputs->is_array())
  {
    for (auto &input : *inputs)
    {
      auto in = validateRuntimeInput(input);
      if (in)
      {
        conf.inputs.push_back(*in);
      }
    }    
  }

  auto boardName = config["boardName"];
  if (!boardName.is_null() && config["boardName"].is_string())
  {
    conf.boardName = config["boardName"];
  }
  return std::optional<RuntimeConfiguration>(conf);
}

inline std::optional<std::vector<std::string> > validateServiceOrdering(json config)
{
  if (!config.is_array())
  {
    return std::nullopt;
  }
  std::vector<std::string> ordering;
  for (auto &service : config)
  {
    if (!service.is_string())
    {
      return std::nullopt;
    }
    ordering.push_back(service);
  }
  return std::optional<std::vector<std::string> >(ordering);
}

}
