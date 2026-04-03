#include "./service.h"

#include "runtime.h"
#include "sub_runtime.h"
#include "runtime_host.h"

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
    , m_host(nullptr)
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
  auto state = json{{"bypass", m_bypass.has_value() && *m_bypass}};
  return state;
}

Data Service::startProcess(const Data& data)
{
  if (m_bypass.has_value() && *m_bypass)
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

void Service::setParentHost(RuntimeHost& host)
{
  if (m_host)
  {
    throw std::runtime_error("Service::setParentHost: host already set");
  }
  m_host = &host;
}

void Service::setParentRuntime(Runtime& runtime)
{
  setParentHost(runtime);
}

void Service::nextAsync(Data data, std::function<void(Data)> callback)
{
  if (!m_host)
  {
    throw std::runtime_error("Service::nextAsync: host not set");
  }

  m_host->processFrom(*this, data, true, callback);
}

Data Service::next(Data data, bool immediately)
{
  if (!m_host)
  {
    throw std::runtime_error("Service::next: host not set");
  }
  if (!immediately)
  {
    m_host->scheduleProcessFrom(*this, data);
    return Null(); // no immediate result - stop processing
  }
  return m_host->processFrom(*this, data);
}

bool Service::isConnected() const
{
  if (!m_host)
  {
    throw std::runtime_error("Service::isConnected: host not set");
  }
  return m_host->isConnected(*this);
}

json& Service::mergeBypassState(json &state) const
{
  state.update(json{{"bypass", m_bypass.has_value() && *m_bypass}});
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
  return m_bypass.has_value() && *m_bypass;
}

void Service::sendNotification(const Data& value) const
{
  if (m_host)
  {
    m_host->sendData(value, MessagePurpose::NOTIFICATION, m_instanceId);
  }
}

bool Service::onBypassChanged(bool bypass)
{
  return bypass; // accept the bypass request by default
}

bool Service::supportsSubservices() const
{
  return false;
}

// ── Sub-runtime support ───────────────────────────────────────────────────────

std::shared_ptr<SubRuntime> Service::createSubRuntime(const json& servicesConfig)
{
  if (!m_host)
  {
    throw std::runtime_error("Service::createSubRuntime: host not set");
  }
  return m_host->createSubRuntime(*this, servicesConfig);
}

// ── Multi-emit support ────────────────────────────────────────────────────────

void Service::emit(Data partialResult)
{
  // nextAsync posts via App::postCallback, making this safe to call from
  // a background thread.  Each emission drives an independent traversal of
  // the services that follow this one in the outer pipeline.
  nextAsync(std::move(partialResult));
}

}
