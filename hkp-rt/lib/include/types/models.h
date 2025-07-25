#pragma once

#include <nlohmann/json.hpp>
using json = nlohmann::json;

namespace hkp {

struct ServiceClass
{
  ServiceClass() = default;
  ServiceClass(std::string serviceId) : serviceId{serviceId} {}

  std::string serviceId;
};

struct ServiceDescriptor : ServiceClass
{
  ServiceDescriptor() = default;
  ServiceDescriptor(std::string serviceId, std::string instanceId, std::string instanceName)
    : ServiceClass{serviceId}, instanceId{instanceId}, instanceName{instanceName} { }

  std::string instanceId;
  std::string instanceName;
};

struct ExternalServiceInput
{
  std::string id;
  std::string url;
};


struct ServiceConfiguration : ServiceDescriptor
{
  ServiceConfiguration() = default;
  ServiceConfiguration(std::string serviceId, std::string instanceId, std::string instanceName, json s)
    : ServiceDescriptor{serviceId, instanceId, instanceName} { state = s; }

  json state;
  std::vector<ExternalServiceInput> inputs;
};

struct RuntimeInput 
{
  enum Type
  {
    PROCESS,
    CONFIGURE,
    EXTERNAL
  };
  std::string id;
  std::string url;
  std::string serviceId;
  std::string runtimeId;
  std::string runtimeUrl;
  Type type;
};

struct RuntimeConfiguration
{
  // describe the runtime state
  std::string runtimeId;
  std::string runtimeName;
  std::string boardName;
  std::vector<ServiceConfiguration> services;

  // readonly values 
  std::string outputUrl;
  // inputs are provided by services the runtime (external) hosts or by the runtime (process or config)
  std::vector<RuntimeInput> inputs;
};

json jsonSerialise(const RuntimeConfiguration& conf);
json jsonSerialise(const RuntimeInput& input);

std::string runtimeTypeAsString(RuntimeInput::Type t);
RuntimeInput::Type parseRuntimeType(const std::string& t);

}
