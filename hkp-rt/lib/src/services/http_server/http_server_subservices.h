#pragma once

#include <iostream>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../../sub_runtime.h"

namespace hkp {

class Session;
class HttpServerImpl;

class HttpServerSubservices : public Service
{
public:
  static std::string serviceId() { return "http-server-subservices"; }

  explicit HttpServerSubservices(const std::string& instanceId);
  ~HttpServerSubservices();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

protected:
  bool supportsSubservices() const override { return true; }
  bool onBypassChanged(bool bypass) override;

  void onNewSession(std::shared_ptr<Session> session,
                    const std::string& path,
                    const std::string& method,
                    bool awaitResponse = true);

private:
  bool start();
  bool stop();
  void syncSubserviceStates();
  void rebuildSubservices();

private:
  std::shared_ptr<HttpServerImpl> m_impl;
  std::string m_mode;
  std::shared_ptr<SubRuntime> m_subservices;
  std::vector<json> m_subserviceConfig;
};

} // namespace hkp