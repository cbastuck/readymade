#pragma once

#include <types/types.h>

#include "./uuid.h"

class Runtime;

class Service
{
public:
  Service(const std::string& instanceId = generateUUID(), const std::string& instanceName = "");
  virtual json configure(Data data);
  virtual json getState() const;

  Data startProcess(const Data& data = Undefined());
  void setParentRuntime(Runtime &runtime);
  Data next(Data data = Undefined());
  bool isConnected() const;

  inline const std::string &getId() const { return m_instanceId; }
  inline const std::string &getName() const { return m_instanceName; }
  virtual std::string getServiceId() const = 0;

protected:
  virtual Data process(Data data = Undefined()) = 0;
  virtual bool onBypassChanged(bool bypass);
  json& mergeBypassState(json &state) const;
  void sendNotification(const Data& params) const;
  void setBypass(bool bypass);
  bool isBypass() const;
  
private:
  void notifyRuntime(Data data) const;
  OwnsMe<Runtime> m_runtime;  

protected:
  std::string m_instanceName;
  std::string m_instanceId;
  std::optional<bool> m_bypass;
};