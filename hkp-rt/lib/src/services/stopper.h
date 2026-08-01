#pragma once

#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: stopper
 * Service Name: Stopper
 * Runtime: hkp-rt
 * Modes: none
 * Key Config: none (bypass turns it back into a passthrough)
 * IO: in=anything -> out=Null (nothing is forwarded)
 * Arrays: passes nothing on, so array handling does not apply
 * Binary: same
 * MixedData: same
 *
 * Returns Null on every call, which the runtime reads as "nothing to pass on":
 * the services after it are not called, and the runtime produces no result, so
 * the next runtime in the chain is not driven either.
 *
 * That last part is the reason to reach for it on a board with several
 * runtimes. Runtimes are chained — the result of one becomes the input of the
 * next — so a runtime whose work is a side effect rather than a value should
 * end here, instead of feeding whatever it happened to produce into the next
 * runtime. A runtime serving an endpoint is the usual case: with a nested
 * pipeline configured, http-server-subservices has already answered its caller
 * by the time the outer services run, so ending the chain here costs nothing.
 *
 * Mirrors hkp-node's `stopper` and the browser runtime's
 * `hookup.to/service/stopper`.
 */
namespace hkp {

class Stopper : public Service
{
public:
  static std::string serviceId() { return "stopper"; }

  Stopper(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  {
    Service::configure(data); // handles bypass
    return getState();
  }

  json getState() const override
  {
    return Service::mergeStateWith(json::object());
  }

  // Bypass is handled by Service::startProcess, which passes the input straight
  // through without calling this at all.
  Data process(Data) override
  {
    return Null();
  }
};

}
