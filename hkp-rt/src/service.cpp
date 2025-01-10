#include "./service.h"

#include "runtime.h"

Service::Service(std::string instanceId)
    : m_instanceId(instanceId),
      m_instanceName(instanceId),
      m_runtime(nullptr)
{
}

json Service::configure(Data data)
{
  return json{};
}

Data Service::process(Data data)
{
  return Undefined();
}

void Service::setParentRuntime(Runtime &runtime)
{
  if (m_runtime)
  {
    throw std::runtime_error("Service::setRuntime: runtime already set");
  }
  m_runtime = OwnsMe<Runtime>(&runtime);
}

Data Service::next(Data data)
{
  if (!m_runtime)
  {
    throw std::runtime_error("Service::next: runtime not set");
  }
  return m_runtime->processNext(*this, data);
}

bool Service::isConnected() const
{
  if (!m_runtime)
  {
    throw std::runtime_error("Service::isConnected: runtime not set");
  }
  return m_runtime->isConnected(*this);
}

void Service::notifyRuntime(Data data)
{
  if (!m_runtime)
  {
    throw std::runtime_error("Service::notifyRuntime: runtime not set");
  }
  m_runtime->onServiceNotification(m_instanceId, data);
}