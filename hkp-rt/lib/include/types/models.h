#pragma once

#include <nlohmann/json.hpp>
using json = nlohmann::json;

namespace hkp {

struct ServiceClass
{
  ServiceClass() = default;
  ServiceClass(std::string serviceId) : serviceId{serviceId} {}

  std::string serviceId;
  // Set by services whose state and configuration follow a revised contract, so
  // the frontend can pick the matching UI ("<serviceId>@<version>").
  std::string version;
  std::vector<std::string> capabilities;
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
  /**
   * Whether this runtime should be torn down once the last client that was
   * connected to it disconnects.
   *
   * Declared by whoever creates it, because only they know: a browser running a
   * board says true — it is the controller, and its runtimes should not outlive
   * it — while a coordinator, a config file or a script says nothing and gets a
   * runtime that lives until it is deleted.
   *
   * False means persist. Cleanup is opted into, so nothing that exists today
   * starts disappearing, and a runtime is never reaped because of who happened
   * to connect to it.
   */
  bool garbageCollected = false;
  /**
   * Whether this runtime records anything at all.
   *
   * False unless the board turns it on. A board that is not being looked into
   * has no reason to be writing a line per call to somebody's disk, and a log
   * kept by default is one nobody decided to keep — including for the data it
   * holds.
   */
  bool logging = false;
  /**
   * The least severe level this runtime records.
   *
   * The flow itself — every service call and return — is recorded at `debug`,
   * so this is what decides whether a board keeps a trace of what ran or only
   * what its services chose to say.
   */
  std::string logLevel = "info";
  /**
   * Whether an entry may carry the `data` a service passed with it.
   *
   * Only service-authored entries have one: the flow this runtime records for
   * itself never carries the values passing through, so nothing reaches a log
   * unless a service was configured to put it there. That per-service opt-in is
   * the real gate, which is why this defaults to allowed. False is a board-wide
   * override for a deployment that must never write payloads.
   */
  bool logData = true;
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
