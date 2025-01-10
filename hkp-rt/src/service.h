#pragma once

#include <types/types.h>

#include "./uuid.h"

class Runtime;

class Service
{
public:
  Service(std::string instanceId = generateUUID());
  virtual json configure(Data data);
  virtual Data process(Data data = Undefined());

  void setParentRuntime(Runtime &runtime);
  Data next(Data data = Undefined());
  bool isConnected() const;

  void notifyRuntime(Data data);

  inline const std::string &getId() const { return m_instanceId; }
  inline const std::string &getName() const { return m_instanceName; }
  
  virtual std::string getServiceId() const = 0;
  virtual json getState() const = 0;

protected:
  std::string m_instanceName;
  std::string m_instanceId;
  OwnsMe<Runtime> m_runtime;
};