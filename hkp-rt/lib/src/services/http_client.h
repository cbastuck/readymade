#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: http-client
 * Service Name: HttpClient
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

struct HttpClientImpl;

class HttpClient : public Service 
{
public:
  static std::string serviceId() { return "http-client"; }

  HttpClient(const std::string& instanceId);
  ~HttpClient();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  std::unique_ptr<HttpClientImpl> m_impl;
};

}
