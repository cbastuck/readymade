#include "./runtime.h"

#include <fstream>
#include <boost/beast.hpp>

#include "./app.h"
#include "./registry.h"
#include "./service.h"
#include "./server.h"
#include "./sub_runtime.h"

#include <types/validation.h>
#include <types/message.h>
#include "common.h"

namespace hkp
{

Runtime::Runtime(OwnsMe<App> app, const std::string& runtimeId, const std::string& runtimeName)
  : m_app(app)
  , m_runtimeId(runtimeId)
  , m_runtimeName(runtimeName)
{
  // Notifications are served by the shared Server WebSocket (one port for the
  // whole process, multiplexed by runtimeId), not a per-runtime socket. Nothing
  // to start here; the Server owns the transport.
}

Runtime::~Runtime()
{
  // Wind down any async service workers while this Runtime — its service list,
  // process context, everything — is still fully alive. A worker's final emit()
  // then traverses a live pipeline; joining later (during member destruction)
  // would let it touch already-destroyed state.
  for (auto& svc : m_services)
  {
    svc->shutdown();
  }
}

void Runtime::onWebSocketMessage(const std::string& message, bool isBinary)
{
  if (isBinary)
  {
    try
    {
      MessageHeader header;
      auto data = Message::deserializeFromString(message, &header);
      onSessionBinaryData(data, header);
    }
    catch (const std::exception& e)
    {
      std::cerr << "Runtime::onWebSocketMessage failed to process binary frame: " << e.what() << std::endl;
    }
    return;
  }

  json msg;
  try
  {
    msg = json::parse(message);
  }
  catch (const std::exception& e)
  {
    std::cerr << "Runtime::onWebSocketMessage failed to parse JSON: " << e.what() << std::endl;
    return;
  }
  if (!msg.is_object())
  {
    std::cerr << "Runtime::onWebSocketMessage: invalid JSON object received: " << message << std::endl;
    return;
  }
  try
  {
    onSessionJSONData(msg);
  }
  catch (const std::exception& e)
  {
    std::cerr << "Runtime::onWebSocketMessage failed to handle JSON message: " << e.what() << std::endl;
  }
}

void Runtime::loadFromDisk(const std::string& path)
{
  std::cout << "Loading runtime from: " << path << std::endl;
  std::ifstream ifs(path);
  if (!ifs)
  {
    throw std::runtime_error("Could not open file: " + path);
  }
  json jf = json::parse(ifs);
  load(jf);
}

void Runtime::load(const json& buffer)
{
  auto rt = validateRuntime(buffer);
  if (!rt)
  {
    throw std::runtime_error("Runtime::load: invalid runtime configuration");
  }

  load(*rt);
}

void Runtime::load(const RuntimeConfiguration& config)
{
  m_services.clear();

  if (!config.boardName.empty())
  {
    m_boardName = config.boardName;
  }
  m_runtimeId = config.runtimeId;
  m_runtimeName = config.runtimeName;
  m_garbageCollected = config.garbageCollected;
  m_logData = config.logData;
  m_logging = config.logging;
  m_logLevel = levelFromString(config.logLevel);
  auto services = config.services;
  for (auto &service : services)
  {
    std::string serviceId = service.serviceId;
    std::string instanceId = service.instanceId;
    auto svc = m_app->createService(serviceId, instanceId);
    if (!svc)
    {
      throw std::runtime_error("Service not found: " + serviceId);
    }
    svc->setParentRuntime(*this);
    m_services.push_back(svc); // this implicitly connects
  }

  auto service = m_services.begin();
  for (auto &config : services)
  {
    auto cfg = config.state;
    if (!cfg.is_null())
    {
      if ((*service)->configure(cfg).is_null())
      {
        throw std::runtime_error("Runtime::load: failed to configure service");
      }
    }
    ++service;
  }

  m_inputs = config.inputs;
}

RuntimeConfiguration Runtime::getConfiguration() const
{
  RuntimeConfiguration config;
  config.runtimeId = m_runtimeId;
  config.runtimeName = m_runtimeName; 
  config.boardName = m_boardName;
  config.garbageCollected = m_garbageCollected;
  config.logData = m_logData;
  config.logging = m_logging;
  config.logLevel = toString(m_logLevel);

  for (auto &svc : m_services)
  {
    ServiceConfiguration sc;
    sc.serviceId = svc->getServiceId();
    sc.instanceId = svc->getId();
    if (const auto* serviceClass = m_app->findServiceClass(sc.serviceId))
    {
      sc.version = serviceClass->version;
      sc.capabilities = serviceClass->capabilities;
    }
    sc.state = svc->getState();
    config.services.push_back(sc);
    
    for (auto& input : svc->getExternalInputs())
    {
      sc.inputs.push_back(input);
      config.inputs.push_back(RuntimeInput{
        .id = input.id,
        .url = replaceHostWithExternalAddress(input.url),
        .serviceId = svc->getServiceId(),
        .runtimeId = m_runtimeId,
        .runtimeUrl = getRuntimeUrl(),
        .type = RuntimeInput::EXTERNAL
      });
    }
  }
  
  for (RuntimeInput input: m_inputs)
  {
    input.url = getRuntimeUrl() + "/services/" + input.serviceId;
    input.runtimeId = m_runtimeId;
    input.runtimeUrl = getRuntimeUrl();
    config.inputs.push_back(input);
  }

  auto server = m_app->getServer();
  if (server)
  {
    // Notifications share the REST server's port; the connection binds to this
    // runtime via the protocol handshake ({type, id}), so the path is fixed.
    config.outputUrl = "ws://" + server->externalIP() + ":" + std::to_string(server->port()) + "/notifications";
  }
  
  return config;
}

json Runtime::configureService(const std::string &instanceId, json config)
{
  auto it = findServiceById(instanceId);
  if (it == m_services.end())
  {
    return false;
  }

  return (*it)->configure(config);
}

json Runtime::getServiceState(const std::string &instanceId) const
{
  auto it = findServiceById(instanceId);
  if (it == m_services.end())
  {
    return false;
  }

  return (*it)->getState();
}

json Runtime::getServices() const
{
  json services;
  for (auto &svc : m_services)
  {
    auto s = json{
      { "serviceId", svc->getServiceId() },
      { "instanceId", svc->getId() },
      { "instanceName", svc->getName() },
    };
    if (const auto* serviceClass = m_app->findServiceClass(svc->getServiceId()))
    {
      if (!serviceClass->version.empty())
      {
        s["version"] = serviceClass->version;
      }
    }
    s.update(json{{"state", svc->getState()}});
    services.push_back(s);
  }
  return services; 
}

void Runtime::sendData(Data data, MessagePurpose purpose, const std::string& sender, std::function<void(Data)> callback)
{
  // Marshal onto the event loop and hand the serialized frame to the shared
  // Server WebSocket, which fans it out to the connections bound to this
  // runtime. (Server::sendNotification / Crow's send_binary are thread-safe.)
  //
  // Capture app + runtimeId by value, not `this`: this callback runs later, and
  // a notification posted just before the Runtime is torn down (e.g. a worker's
  // final emit during shutdown) must not dereference a freed Runtime.
  App* app = m_app.get();
  std::string runtimeId = m_runtimeId;
  app->postCallback([app, runtimeId, data, purpose, sender]() {
    try
    {
      auto server = app->getServer();
      if (server)
      {
        server->sendNotification(runtimeId, Message::serializeToString(data, purpose, sender));
      }
    }
    catch (const std::exception& e)
    {
      // A single unserializable payload (e.g. a streamed text chunk split
      // mid-UTF-8) must never terminate the event-loop thread and take the whole
      // process with it. Drop it and carry on.
      std::cerr << "Runtime::sendData: dropping notification: " << e.what() << std::endl;
    }
  });
}

void Runtime::notifyProcessFinished(const Service& service, const Data& data)
{
  // Same lifecycle event the synchronous loop sends, but driven by emit() when
  // deferred async work lands — so a service's processing indicator brackets the
  // real duration instead of the instant deferCompletion() return.
  sendServiceLifecycleNotification(service, "call-process-finished", data);
}

Data Runtime::process(Data data, ProcessContext context)
{
  // Restored rather than cleared, so that a service calling back into this
  // runtime from inside its own process — the pull a cache miss performs —
  // leaves the outer call running under what it started with.
  const auto previous = m_context;
  const auto hadContext = m_hasContext;
  m_context = context;
  m_hasContext = true;

  onProcessBegin();
  if (m_services.empty())
  {
    m_context = previous;
    m_hasContext = hadContext;
    return data;
  }
  auto result = processFrom(*m_services.front(), data, false);
  const auto& out = onProcessEnd(result, context);

  m_context = previous;
  m_hasContext = hadContext;
  return out;
}

Data Runtime::processAt(const std::string& instanceId, Data data, ProcessContext context)
{
  auto it = findServiceById(instanceId);
  if (it == m_services.cend())
  {
    throw std::runtime_error("Runtime::processAt service not found in runtime");
  }

  // The same context bookkeeping process() does, and for the same reason: a
  // service pulling back into this runtime from inside its own call must leave
  // the outer call running under what it started with.
  const auto previous = m_context;
  const auto hadContext = m_hasContext;
  m_context = context;
  m_hasContext = true;

  onProcessBegin();
  auto result = processFrom(**it, data, /*advanceBefore=*/false);
  const auto& out = onProcessEnd(result, context);

  m_context = previous;
  m_hasContext = hadContext;
  return out;
}

void Runtime::log(const Service& svc, LogLevel level, const std::string& event,
                  const nlohmann::json& data)
{
  // Nothing to attribute an entry to means nothing worth recording: a service
  // logging outside a call has no run, and an entry naming no run cannot be
  // found again.
  //
  // Deliberately not also skipping when no local target is registered: entries
  // leave this runtime over its socket as well, so "nobody registered a
  // callback here" does not mean nobody is collecting. Whether anything is
  // attached to that socket is the server's to know.
  //
  // Below the level the board keeps is the same as off: no entry is built.
  if (!m_logging || levelRank(level) < levelRank(m_logLevel) || !m_hasContext)
    return;

  LogEntry entry;
  entry.runId = m_context.runId;
  entry.parentRunId = m_context.parentRunId;
  entry.ts = isoTimestamp();
  entry.runtimeId = m_runtimeId;
  entry.serviceUuid = svc.getId();
  entry.level = level;
  entry.event = event;
  if (m_logData && !data.is_null())
    entry.data = data;

  forwardLog(entry);
}

void Runtime::forwardLog(const LogEntry& entry)
{
  for (const auto& target : m_logTargets)
    target(entry);

  // Out to whoever is collecting this runtime's output — in a deployed board,
  // the coordinator, which is the only instance that keeps a board's log.
  //
  // Captured by value rather than through `this`, as sendData is and for the
  // same reason: this runs later, and an entry recorded just before teardown
  // must not dereference a freed Runtime.
  App* app = m_app.get();
  const std::string runtimeId = m_runtimeId;
  const nlohmann::json message = {{"type", "log"}, {"entry", entry.toJson()}};
  app->postCallback([app, runtimeId, message]() {
    try
    {
      if (auto server = app->getServer())
      {
        server->sendText(runtimeId, message.dump());
      }
    }
    catch (const std::exception& e)
    {
      // Losing an entry is not worth taking the event loop down for.
      std::cerr << "Runtime::forwardLog: dropping entry: " << e.what() << std::endl;
    }
  });
}

void Runtime::registerLogTarget(std::function<void(const LogEntry&)> target)
{
  m_logTargets.push_back(std::move(target));
}

Data Runtime::processFrom(const Service &service, Data data, bool advanceBefore, std::function<void(Data)> callback)
{
  onProcessBegin();
  auto it = findServiceById(service.getId());
  if (it == m_services.cend())
  {
    throw std::runtime_error("Runtime::processNext service not found in runtime");
  }

  for (auto next = advanceBefore ? std::next(it) : it;
       next != m_services.cend();
       ++next)
  {
    sendServiceLifecycleNotification(**next, "call-process", data);
    // The flow itself, at debug: which service the runtime called, and below,
    // what it returned and how long it took.
    //
    // Deliberately without the value flowing through. The level says how much
    // of the shape of a run to keep, and turning it up must not also start
    // recording the data — what flows through is recorded only where a service
    // was configured to record it.
    log(**next, LogLevel::Debug, "service.process");
    const auto startedAt = std::chrono::steady_clock::now();
    data = (*next)->startProcess(data);
    if ((*next)->takeProcessDeferred())
    {
      // The service handed its work to a worker and will emit() the real result
      // later; emit() sends this service's "call-process-finished" then. Withhold
      // it here and stop the synchronous push (the deferred result re-enters via
      // emit → nextAsync, driving the services that follow).
      return onProcessEnd(Null());
    }
    sendServiceLifecycleNotification(**next, "call-process-finished", data);
    {
      LogEntry done;
      done.runId = m_context.runId;
      done.parentRunId = m_context.parentRunId;
      done.ts = isoTimestamp();
      done.runtimeId = m_runtimeId;
      done.serviceUuid = (*next)->getId();
      done.level = LogLevel::Debug;
      done.event = "service.processed";
      done.durationMs = std::chrono::duration<double, std::milli>(
                          std::chrono::steady_clock::now() - startedAt).count();
      if (m_logging && levelRank(LogLevel::Debug) >= levelRank(m_logLevel) && m_hasContext)
        forwardLog(done);
    }
    if (isNull(data)) // stop processing on null
    {
      // Where the run ended, named. Above debug because it is the outcome of
      // the run rather than a step in it.
      log(**next, LogLevel::Info, "pipeline.stopped");
      return onProcessEnd(data);
    }
    if (isEarlyReturn(data))
    {
      return onProcessEnd(getControlFlowData(data), {}, callback);
    }
  }
  return onProcessEnd(data, {}, callback);
}

void Runtime::sendServiceLifecycleNotification(const Service& service, const std::string& state, const Data& data)
{
  json payloadData = nullptr;
  if (auto j = getJSONFromData(data))
  {
    payloadData = *j;
  }
  else if (auto s = getStringFromData(data))
  {
    payloadData = *s;
  }
  else if (isNull(data))
  {
    payloadData = nullptr;
  }
  else if (isUndefined(data))
  {
    payloadData = "<undefined>";
  }
  else
  {
    // Keep lifecycle messages JSON-serializable for the frontend.
    payloadData = stringify(data);
  }

  sendData(
    json{{"__internal", json{{"state", state}, {"data", payloadData}}}},
    MessagePurpose::NOTIFICATION,
    service.getId());
}

void Runtime::scheduleProcessFrom(const Service &service, Data data, bool advanceBefore)
{
  auto pService = &service;
  for (size_t idx = 0; idx < m_scheduledProcesses.size(); ++idx) 
  {
    if (!m_scheduledProcesses[idx]) 
    {
       m_scheduledProcesses[idx] = [this, pService, data, advanceBefore]() {
        return this->processFrom(*pService, data, advanceBefore);
      };
      m_app->postCallback([this]() {  processScheduled(); });
      return;
    }
  }
  
  std::cout << "Runtime::scheduleProcessFrom() No empty slot available in m_scheduledProcesses" << std::endl;
}

void Runtime::processScheduled()
{
  auto cpy = m_scheduledProcesses;
  m_scheduledProcesses.fill(nullptr); // clear scheduled processes
  for (auto &process : cpy)
  {
    if (process)
    {
      process();
    }
  }
}

json Runtime::appendService(const ServiceConfiguration& newService)
{
  auto svc = m_app->createService(newService.serviceId, newService.instanceId);
  if (!svc)
  {
    return false;
  }
  svc->setParentRuntime(*this);
  m_services.push_back(svc);
  if (!newService.state.is_null())
  {
    return svc->configure(newService.state);
  }
  return svc->getState();
}

bool Runtime::removeService(const std::string& instanceId)
{
  auto it = findServiceById(instanceId);
  if (it == m_services.end())
  {
    return false;
  }
  m_services.erase(it);
  return true;
}

bool Runtime::insertService(std::shared_ptr<Service> newService, std::shared_ptr<Service> predecessor)
{
  if (predecessor)
  {
    auto it = findServiceById(predecessor->getId());
    if (it == m_services.cend())
    {
      throw std::runtime_error("Runtime::insert: predecessor not found in runtime");
    }
    m_services.insert(std::next(it), newService);
    return true;
  }

  m_services.push_back(newService);
  return true;
}

std::shared_ptr<SubRuntime> Runtime::createSubRuntime(const Service& ownerInParent,
                                                      const json& servicesConfig)
{
  auto factory = [this](const std::string& serviceId, const std::string& instanceId)
  {
    return m_app->createService(serviceId, instanceId);
  };
  auto post = [this](std::function<void()> fn)
  {
    m_app->postCallback(std::move(fn));
  };

  auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent,
                                         std::move(factory), std::move(post));
  sr->populate(servicesConfig);
  return sr;
}

bool Runtime::rearrangeServices(const std::vector<std::string>& newOrder)
{
  std::list<std::shared_ptr<Service>> sorted;
  for (auto &id : newOrder)
  {
    auto it = findServiceById(id);
    if (it == m_services.cend())
    {
      return false;
    }
    sorted.push_back(*it);
  }
  m_services = sorted;
  return true;
}

bool Runtime::isConnected(const Service &svc) const
{
  return findServiceById(svc.getId()) != m_services.cend();
}

std::list<std::shared_ptr<Service>>::const_iterator Runtime::findServiceById(const std::string& instanceId) 
{
  return std::find_if(
    m_services.begin(), 
    m_services.end(), 
    [&instanceId](auto svc) { return svc->getId() == instanceId; }
  );
}

std::list<std::shared_ptr<Service>>::const_iterator Runtime::findServiceById(const std::string& instanceId) const
{
  return std::find_if(
    m_services.cbegin(), 
    m_services.cend(), 
    [&instanceId](auto ptr) { return ptr.get()->getId() == instanceId; }
  );
}

std::string Runtime::replaceHostWithExternalAddress(std::string url) const
{
  if (!m_app->getServer())
  {
    return url;
  }
  return replaceAll(url, "0.0.0.0", m_app->getServer()->externalIP());
}

std::string Runtime::getRuntimeUrl() const
{
  if (!m_app->getServer())
  {
    std::cerr << "Runtime::getRuntimeUrl: no server available" << std::endl;
     return "";
  }
  return m_app->getServer()->externalIP() + ":" + std::to_string(m_app->getServer()->port()) + "/runtimes/" + m_runtimeId;
}

void Runtime::onProcessBegin()
{
  m_processDepth.increment();
}

const Data& Runtime::onProcessEnd(const Data& data, ProcessContext context, std::function<void(Data)> callback)
{
  if (m_processDepth.decrement() == 0)
  {  
    // if we are the last initiator, we should communicate the result
    if (!m_boardName.empty())
    {
        std::string requestId = "RUNTIME";
        auto purpose = MessagePurpose::RESULT;
        if (callback)
        {
          requestId = generateUUID();
        }
        else if (!context.requestId.empty())
        {
          requestId = context.requestId;
        }
        if (callback)
        {
          purpose = MessagePurpose::RESULT_AWAITING_RESPONSE;
          std::cout << "Await pending resolve for request: " << requestId << std::endl;
          if (!storePendingCallback(requestId, callback))
          {
            std::cerr << "Runtime::onProcessEnd: No empty slot available in m_pendingResolve" << std::endl;
          }
        }
        else if (!context.requestId.empty())
        {
          purpose = MessagePurpose::RESULT_WITH_REQUEST_ID;
        }
        sendData(data, purpose, requestId, callback);
    }
  }
  return data;
}

bool Runtime::storePendingCallback(const std::string& requestId, std::function<void(Data)> callback)
{
  for (auto& slot : m_pendingResolve)
  {
    if (slot.callback == nullptr)
    {
      slot.requestId = requestId;
      slot.callback = callback;
      return true;
    }
  }
  return false;
}

std::function<void(Data)> Runtime::findAndRemovePendingCallback(const std::string& requestId)
{
  for (auto& slot : m_pendingResolve)
  {
    if (slot.callback != nullptr && slot.requestId == requestId)
    {
      auto callback = slot.callback;
      slot.callback = nullptr;
      slot.requestId.clear();
      return callback;
    }
  }
  return nullptr;
}

void Runtime::onSessionBinaryData(Data data, MessageHeader header)
{
  if (header.messagePurpose == MessagePurpose::NOTIFICATION)
  {
      auto requestId = header.sender;
      auto callback = findAndRemovePendingCallback(requestId);
      if (callback)
      {
        callback(data);
      }
      else
      {
        std::cout << "Runtime::onSessionBinaryData: no pending resolve available" << std::endl;
      }
  }
  else
  {
    this->process(data);
  }
}

void Runtime::onSessionJSONData(json msg)
{
  auto data = msg["params"];
  if (data.is_null())
  {
    std::cout << "Runtime::onSessionJSONData: received null data: " << msg.dump() << std::endl;
    return;
  }
  auto context = msg["context"];
  auto type = msg["type"].get<std::string>();
  if (type == "processRuntime")
  {
    process(data, ProcessContext::fromJson(context));
  }
  else if (type == "resolveResult")
  {
    std::cout << "Need to resolve the result: " << data << context << std::endl;
    auto requestId = ProcessContext::fromJson(context).requestId;
    auto callback = findAndRemovePendingCallback(requestId);
    if (callback)
    {
      // A JSON string arriving here was originally a C++ std::string (e.g. an
      // HTML page) that was round-tripped through the browser WebSocket as a
      // JSON-encoded string.  Re-wrap it as Data(std::string) so that
      // sendResult() dispatches to sendHtmlResponse() rather than
      // sendJsonResponseWithCors().
      if (data.is_string())
      {
        auto str = data.get<std::string>();
        Data d = Data(str);
        callback(d);
      }
      else
      {
        Data d = Data(data);
        callback(d);
      }
    }
    else
    {
      std::cout << "Runtime::onSessionJSONData: no pending resolve available" << std::endl;
    }
  }
  else
  {
    std::cout << "Runtime::onSessionJSONData: unsupported message type: " << msg["type"] << std::endl;
  }
}

}
