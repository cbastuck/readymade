#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

class HttpClient : public hkp::Service 
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
  struct Impl;
  std::unique_ptr<Impl> m_impl;
};
