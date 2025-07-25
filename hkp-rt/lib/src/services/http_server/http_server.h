#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class HttpServerImpl;

class HttpServer : public Service 
{
public:
  static std::string serviceId() { return "http-server"; }

  HttpServer(const std::string& instanceId);
  ~HttpServer();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

protected:
  bool onBypassChanged(bool bypass) override;

private:  
  bool start();
  bool stop();

private:
  std::shared_ptr<HttpServerImpl> m_impl;
};

}
