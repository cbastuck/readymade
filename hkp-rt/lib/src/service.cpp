#include "./service.h"

#include "runtime.h"

namespace hkp
{

Service::Service(const std::string& instanceName)
  : m_instanceId(generateUUID())
  , m_instanceName(instanceName)
{

}

Service::Service(const std::string& instanceId, const std::string& instanceName)
    : m_instanceId(instanceId)
    , m_instanceName(instanceName)
    , m_runtime(nullptr)
{
}

json Service::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    if (m_bypass.has_value()) 
    {
      auto bypassUpdate = getPropertyUpdate(*buf, "bypass", *m_bypass);
      if (bypassUpdate)
      {
        setBypass(*bypassUpdate);
      } 
    }
    else // bypass has not yet been set
    { 
      auto bypass = getProperty<bool>(*buf, "bypass");
      setBypass(bypass ? *bypass : false);
    }
  }
  
  return getState();
}

json Service::getState() const
{
  return json{{"bypass", *m_bypass}};
}

Data Service::startProcess(const Data& data)
{
  if (*m_bypass)
  {
    return data;
  }
  return process(data);
}

std::vector<ExternalServiceInput> Service::getExternalInputs() const
{
  return std::vector<ExternalServiceInput>{};
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

void Service::nextAsync(Data data, std::function<void(Data)> callback)
{
  if (!m_runtime)
  {
    throw std::runtime_error("Service::nextAsync: runtime not set");
  }

  m_runtime->processFrom(*this, data, true, callback);
}

Data Service::next(Data data, bool immediately)
{
  if (!m_runtime)
  {
    throw std::runtime_error("Service::next: runtime not set");
  }
  if (!immediately)
  {
    m_runtime->scheduleProcessFrom(*this, data);
    return Null(); // no immediate result - stop processing
  }
  return m_runtime->processFrom(*this, data);
}

bool Service::isConnected() const
{
  if (!m_runtime)
  {
    throw std::runtime_error("Service::isConnected: runtime not set");
  }
  return m_runtime->isConnected(*this);
}

json& Service::mergeBypassState(json &state) const
{
  state.update(json{{"bypass", m_bypass}});
  return state;
}

void Service::setBypass(bool bypass)
{
  if (m_bypass.has_value() && *m_bypass == bypass)
  {
    return;
  }
  m_bypass = onBypassChanged(bypass);
  sendNotification(json{{"bypass", *m_bypass}});
}

bool Service::isBypass() const
{
  return *m_bypass;
}

void Service::sendNotification(const Data& value) const
{
  if (m_runtime)
  {
    m_runtime->sendData(value, MessagePurpose::NOTIFICATION, m_instanceId);
  }
}

bool Service::onBypassChanged(bool bypass)
{
  return bypass; // accept the bypass request by default
}

}
