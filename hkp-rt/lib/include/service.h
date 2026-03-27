#pragma once

#include <types/types.h>

namespace hkp {

class Runtime;

class Service
{
public:
  Service(const std::string& instanceName = "");
  Service(const std::string& instanceId, const std::string& instanceName);
  virtual json configure(Data data);
  virtual json getState() const;

  Data startProcess(const Data& data = Undefined());
  void setParentRuntime(Runtime &runtime);
  Data next(Data data = Undefined(), bool immediately = true);
  void nextAsync(Data data = Undefined(), std::function<void(Data)> callback = nullptr);
  bool isConnected() const;

  inline const std::string &getId() const { return m_instanceId; }
  inline const std::string &getName() const { return m_instanceName; }
  virtual std::string getServiceId() const = 0;

  // Inputs are a static property of a service, and are not supposed to change through lifetime.
  // Usually services don't provide additional inputs, examples that do are websocket_server_service.h,
  // or in general any "-T-shaped" service.
  virtual std::vector<ExternalServiceInput> getExternalInputs() const;

  virtual Data process(Data data = Undefined()) = 0;
  
protected:
  virtual bool onBypassChanged(bool bypass);
  json& mergeBypassState(json &state) const;
  void sendNotification(const Data& params) const;
  void setBypass(bool bypass);
  bool isBypass() const;

  json mergeStateWith(const json& update) const
  {
    auto state = Service::getState();
    state.update(update);
    return state;
  }
  
private:
  OwnsMe<Runtime> m_runtime;  

protected:
  std::string m_instanceName;
  std::string m_instanceId;
  std::optional<bool> m_bypass;
};

}
