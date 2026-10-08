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

Data Service::nextInRun(Data data, const ProcessContext& context,
                        std::function<void(Data)> callback)
{
  if (!m_host)
    throw std::runtime_error("Service::nextInRun: host not set");
  return m_host->withContext(context, [this, data = std::move(data), callback]() mutable {
    return m_host->processFrom(*this, std::move(data), true, callback);
  });
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
  if (!m_host)
    return;

  if (const auto continued = deferredContext())
  {
    m_host->withContext(*continued, [this, &value]() {
      m_host->sendData(value, MessagePurpose::NOTIFICATION, m_instanceId);
      return Null();
    });
    return;
  }

  // Inside a call this is said in its run. Outside one — a standing source, a
  // meter — it is board work, not an auth-off run and not whoever happens to
  // host the runtime; the runtime says so itself, without a run being made for
  // each report.
  m_host->sendData(value, MessagePurpose::NOTIFICATION, m_instanceId);
}

void Service::log(LogLevel level, const std::string& event,
                  const nlohmann::json& data) const
{
  if (m_host)
  {
    if (const auto continued = deferredContext())
    {
      m_host->withContext(*continued, [this, level, &event, &data]() {
        m_host->log(*this, level, event, data);
        return Null();
      });
    }
    else
    {
      m_host->log(*this, level, event, data);
    }
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

// A service holding no pipeline has nothing inside it to name, and says so by
// answering nothing rather than by being asked to know about addresses.
std::shared_ptr<Service> Service::findNested(const std::string&) const
{
  return nullptr;
}

bool Service::processNested(const std::string&, Data, Data&)
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
  // A deferred answer consumes the context captured by deferCompletion(). Both
  // its lifecycle notification and the pipeline it resumes belong to that
  // same run. Later emissions are a standing arrangement and therefore start
  // independently through nextAsync().
  std::shared_ptr<const ProcessContext> continued;
  takeDeferred(continued);
  if (continued && m_host)
  {
    m_host->withContext(*continued, [this, data = std::move(partialResult)]() mutable {
      m_host->notifyProcessFinished(*this, data);
      return m_host->processFrom(*this, std::move(data), true);
    });
  }
  else
  {
    if (m_host)
      m_host->notifyProcessFinished(*this, partialResult);
    nextAsync(std::move(partialResult));
  }
}

MountHandle Service::mountEndpoint(const std::string& name, MountAdopter adopter)
{
  return m_host ? m_host->mountEndpoint(name, std::move(adopter)) : MountHandle();
}

Data Service::deferCompletion()
{
  m_processDeferred = true;
  std::shared_ptr<const ProcessContext> captured;
  if (m_host)
  {
    if (const auto* context = m_host->currentContext())
      captured = std::make_shared<const ProcessContext>(*context);
  }
  std::lock_guard<std::mutex> lock(m_deferred.mutex);
  m_deferred.context = std::move(captured);
  m_deferred.open.store(true, std::memory_order_release);
  return Null();
}

void Service::endDeferred()
{
  std::shared_ptr<const ProcessContext> continued;
  if (!takeDeferred(continued) || !m_host)
    return;
  // The call is over, with nothing to hand on: the bracket emit() would have
  // closed is closed here, in the run the call was made in.
  if (continued)
  {
    m_host->withContext(*continued, [this]() {
      m_host->notifyProcessFinished(*this, Null());
      return Null();
    });
  }
  else
  {
    m_host->notifyProcessFinished(*this, Null());
  }
}

std::shared_ptr<const ProcessContext> Service::deferredContext() const
{
  if (!m_deferred.open.load(std::memory_order_acquire))
    return nullptr;
  std::lock_guard<std::mutex> lock(m_deferred.mutex);
  return m_deferred.context;
}

bool Service::takeDeferred(std::shared_ptr<const ProcessContext>& context)
{
  if (!m_deferred.open.load(std::memory_order_acquire))
    return false;
  std::lock_guard<std::mutex> lock(m_deferred.mutex);
  if (!m_deferred.open.exchange(false, std::memory_order_acq_rel))
    return false;
  context = std::move(m_deferred.context);
  m_deferred.context.reset();
  return true;
}

bool Service::takeProcessDeferred()
{
  bool deferred = m_processDeferred;
  m_processDeferred = false;
  return deferred;
}

}
