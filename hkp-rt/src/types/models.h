#pragma once

#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct ServiceClass
{
  std::string serviceId;
};

struct ServiceDescriptor : ServiceClass
{
  std::string instanceId;
  std::string instanceName;
};

struct ServiceConfiguration : ServiceDescriptor
{
  json state;
};

struct RuntimeConfiguration
{
  std::string runtimeId;
  std::string runtimeName;
  std::vector<ServiceConfiguration> services;
  std::string outputUrl;
};

json jsonSerialise(const RuntimeConfiguration& conf);