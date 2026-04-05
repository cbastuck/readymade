#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: static
 * Service Name: Static
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class Static : public Service 
{
public:
  static std::string serviceId() { return "static"; }

  Static(const std::string& instanceId);
  ~Static();
  

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  json m_output;
};

}