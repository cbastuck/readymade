#include <app.h>

#include "./registry.h"
#include "./runtime.h"
#include "./uuid.h"

namespace hkp
{

App::App() 
    : m_registry(std::make_unique<Registry>())
    , m_work_guard(boost::asio::make_work_guard(m_io))
{
    startEventLoop();
}

App::~App()
{
  // Tear down runtimes (which joins any async service workers, letting their
  // final emit() post to the io_context) while the event loop is still running,
  // before the io_context is stopped and destroyed.
  removeAllRuntimes();
  stopEventLoop();
}

void App::startEventLoop()
{
  m_eventThread = std::thread(
    [this]() { 
      std::cout << "App event loop..." << std::endl;
      m_io.run(); 
      std::cout << "App finished event loop..." << std::endl;
    }
  );
}


void App::stopEventLoop()
{
  m_io.stop();
  m_work_guard.reset(); // allow the io_context to stop
  m_eventThread.join();
  m_eventThread = std::thread(); // reset the thread
  std::cout << "App stopped event loop..." << std::endl;
}

void App::postCallback(std::function<void()> callback)
{
  if (callback)
  {
    boost::asio::post(m_io, callback);
  }
}

RuntimeConfiguration App::createRuntime(json config)
{
  auto validatedConfig = validateRuntime(config);
  if (!validatedConfig) 
  {
    throw std::runtime_error("RuntimeConfiguration::createRuntime config validation failed");
  }
  return createRuntime(*validatedConfig);
}

RuntimeConfiguration App::createRuntime(RuntimeConfiguration config)
{
  auto runtime = appendRuntime(config); 
  return runtime->getConfiguration();
}

std::vector<RuntimeConfiguration> App::getRuntimes(const std::string& space) const
{
  // Snapshot the shared_ptrs under the lock, then read each runtime's config
  // without holding it — the copies keep the runtimes alive.
  std::vector<std::shared_ptr<Runtime>> snapshot;
  {
    std::lock_guard<std::mutex> lock(m_runtimesMutex);
    for (const auto& rt : m_runtimes)
    {
      if (rt->getSpace() == space)
      {
        snapshot.push_back(rt);
      }
    }
  }
  std::vector<RuntimeConfiguration> configurations;
  for (auto &rt : snapshot)
  {
    configurations.push_back(rt->getConfiguration());
  }
  return configurations;
}

std::optional<RuntimeConfiguration> App::getRuntime(const std::string runtimeId,
                                                    const std::string& space) const
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return std::nullopt;
  }
  return rt->getConfiguration();
}

bool App::removeRuntime(const std::string &id, const std::string& space)
{
  std::shared_ptr<Runtime> removed; // destroyed after the lock is released
  {
    std::lock_guard<std::mutex> lock(m_runtimesMutex);
    auto it = findRuntime(id, space);
    if (it == m_runtimes.end())
    {
      return false;
    }
    removed = *it;
    m_runtimes.erase(it);
  }
  return true;
}

void App::removeAllRuntimes()
{
  std::list<std::shared_ptr<Runtime>> removed; // destroyed after the lock
  {
    std::lock_guard<std::mutex> lock(m_runtimesMutex);
    for (auto it = m_runtimes.begin(); it != m_runtimes.end();)
    {
      if ((*it)->getSpace().empty())
      {
        removed.push_back(*it);
        it = m_runtimes.erase(it);
      }
      else
      {
        ++it;
      }
    }
  }
}

json App::configureService(const std::string &runtimeId, const std::string &instanceId, json config,
                           const std::string& space, const ProcessContext* context)
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return false;
  }
  return rt->configureService(instanceId, config, context);
}

json App::getServiceState(const std::string &runtimeId, const std::string &instanceId) const
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return false;
  }
  return rt->getServiceState(instanceId);
}

json App::getServices(const std::string &runtimeId, const std::string& space) const
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return false;
  }
  return rt->getServices();
}

void App::dispatchRuntimeWsMessage(const std::string& runtimeId, const std::string& message, bool isBinary,
                                   const Caller* caller)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    std::cerr << "App::dispatchRuntimeWsMessage: unknown runtime " << runtimeId << std::endl;
    return;
  }
  rt->onWebSocketMessage(message, isBinary, caller ? *caller : Caller());
}

json App::appendService(const std::string& runtimeId, const ServiceConfiguration& service) {
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return false;
  }
  return rt->appendService(service);
}

json App::removeService(const std::string& runtimeId, const std::string& instanceId) {
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return nullptr;
  }

  return rt->removeService(instanceId) ?
    jsonSerialise(rt->getConfiguration()) :
    nullptr;
}

Data App::processRuntime(const std::string& runtimeId, const Data& data)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return false;
  }
  return rt->process(data);
}

Data App::processRuntime(const std::string& runtimeId, const Data& data, const json& context,
                         const std::string& space)
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return false;
  }
  return rt->process(data, ProcessContext::fromJson(context));
}

Data App::processRuntimeAs(const std::string& runtimeId, const Data& data,
                           const ProcessContext& context, const std::string& space)
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return false;
  }
  return rt->process(data, context);
}

Data App::processServiceAt(const std::string& runtimeId,
                           const std::string& instanceId, const Data& data)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return false;
  }
  return rt->processAt(instanceId, data);
}

Data App::processServiceAtAs(const std::string& runtimeId, const std::string& instanceId,
                             const Data& data, const ProcessContext& context,
                             const std::string& space)
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return false;
  }
  return rt->processAt(instanceId, data, context);
}

bool App::hasService(const std::string& runtimeId, const std::string& instanceId,
                     const std::string& space) const
{
  auto rt = findRuntimeShared(runtimeId, space);
  return rt && rt->holdsService(instanceId);
}

json App::getRegistry() const
{
  auto r = json::array();
   for (auto svc : m_registry->availableServices()) 
   {
     auto entry = json{
       { "serviceName", svc.serviceId },
       { "serviceId", svc.serviceId },
       { "capabilities", svc.capabilities }};
     if (!svc.version.empty())
     {
       entry["version"] = svc.version;
     }
     r.push_back(entry);
   }
  return r;
}

std::list<std::shared_ptr<Runtime>>::iterator App::findRuntime(const std::string& runtimeId,
                                                               const std::string& space)
{
  return std::find_if(
    m_runtimes.begin(), 
    m_runtimes.end(), 
    [&](const auto& rt){ return rt->getId() == runtimeId && rt->getSpace() == space; }
  );
}

std::list<std::shared_ptr<Runtime>>::const_iterator App::findRuntime(const std::string& runtimeId,
                                                                     const std::string& space) const
{
  return std::find_if(
    m_runtimes.cbegin(),
    m_runtimes.cend(),
    [&](const auto& rt){ return rt->getId() == runtimeId && rt->getSpace() == space; }
  );
}

std::shared_ptr<Runtime> App::findRuntimeShared(const std::string& runtimeId,
                                                const std::string& space) const
{
  std::lock_guard<std::mutex> lock(m_runtimesMutex);
  auto it = findRuntime(runtimeId, space);
  return it == m_runtimes.cend() ? nullptr : *it;
}

json App::rearrangeServices(const std::string& runtimeId, const std::vector<std::string>& newOrder)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return false;
  }
  auto success = rt->rearrangeServices(newOrder);
  return success ? jsonSerialise(rt->getConfiguration()) : nullptr;
}

json App::setRuntimeSecrets(const std::string& runtimeId,
                            const std::map<std::string, SecretEntry>& entries)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return nullptr;
  }
  rt->setSecrets(entries);
  return json{{"aliases", rt->secrets().aliases()}};
}

json App::setRuntimeAssets(const std::string& runtimeId,
                           const std::map<std::string, nlohmann::json>& entries)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return nullptr;
  }
  rt->setAssets(entries);
  return json{{"ids", rt->assets()->ids()}};
}

json App::checkRuntimeAsset(const std::string& runtimeId, const std::string& assetId)
{
  auto rt = findRuntimeShared(runtimeId);
  if (!rt)
  {
    return nullptr;
  }
  auto resolution = rt->assets()->resolve(assetScheme() + assetId);
  if (!resolution.asset)
  {
    return json{{"ok", false}, {"problem", resolution.problem}};
  }
  return json{{"ok", true},
              {"mediaType", resolution.asset->mediaType},
              {"size", resolution.asset->content.size()}};
}

json App::setRuntimeState(const std::string& runtimeId, const json& state,
                          const std::string& space)
{
  auto rt = findRuntimeShared(runtimeId, space);
  if (!rt)
  {
    return nullptr;
  }
  if (state.is_object())
  {
    if (state.contains("logging") && state["logging"].is_boolean())
    {
      rt->setLogging(state["logging"].get<bool>());
    }
    if (state.contains("logLevel") && state["logLevel"].is_string())
    {
      rt->setLogLevel(levelFromString(state["logLevel"].get<std::string>()));
    }
    if (state.contains("logData") && state["logData"].is_boolean())
    {
      rt->setLogData(state["logData"].get<bool>());
    }
  }
  const auto config = rt->getConfiguration();
  return json{
    {"logging", config.logging},
    {"logData", config.logData},
    {"logLevel", config.logLevel},
  };
}

namespace
{
// NUL occurs in neither part.
std::string sinkKey(const std::string& runtimeId, const std::string& space)
{
  return space + '\0' + runtimeId;
}
}

void App::setRuntimeOutputSink(const std::string& runtimeId, RuntimeOutputSink sink,
                               const std::string& space)
{
  std::lock_guard<std::mutex> lock(m_sinksMutex);
  m_sinks[sinkKey(runtimeId, space)] = std::move(sink);
}

void App::clearRuntimeOutputSink(const std::string& runtimeId, const std::string& space)
{
  std::lock_guard<std::mutex> lock(m_sinksMutex);
  m_sinks.erase(sinkKey(runtimeId, space));
}

void App::emitRuntimeData(const std::string& runtimeId, const Data& data,
                          MessagePurpose purpose, const std::string& sender,
                          const std::string& space, const ProcessContext* run)
{
  // Copied out under the lock and called without it: a sink may take a while,
  // and may itself replace or remove a sink.
  std::function<void(const Data&, MessagePurpose, const std::string&,
                     const ProcessContext*)> onData;
  {
    std::lock_guard<std::mutex> lock(m_sinksMutex);
    auto it = m_sinks.find(sinkKey(runtimeId, space));
    if (it != m_sinks.end())
    {
      onData = it->second.onData;
    }
  }
  if (onData)
  {
    onData(data, purpose, sender, run);
  }
}

void App::emitRuntimeLog(const std::string& runtimeId, const LogEntry& entry,
                         const std::string& space)
{
  std::function<void(const LogEntry&)> onLog;
  {
    std::lock_guard<std::mutex> lock(m_sinksMutex);
    auto it = m_sinks.find(sinkKey(runtimeId, space));
    if (it != m_sinks.end())
    {
      onLog = it->second.onLog;
    }
  }
  if (onLog)
  {
    onLog(entry);
  }
}

std::shared_ptr<Runtime> App::appendRuntime(const RuntimeConfiguration& config)
{
  // Build and configure the runtime before it becomes visible to other threads.
  auto rt = std::make_shared<Runtime>(this);
  rt->load(config);

  std::shared_ptr<Runtime> replaced; // destroyed after the lock is released
  {
    std::lock_guard<std::mutex> lock(m_runtimesMutex);
    // Replace the one with the same id in the same space.
    auto it = findRuntime(config.runtimeId, config.space);
    if (it != m_runtimes.end())
    {
      replaced = *it;
      m_runtimes.erase(it);
    }
    m_runtimes.push_back(rt);
  }
  return rt;
}

std::shared_ptr<Service> App::createService(const std::string& serviceId)
{
  return m_registry->create(serviceId, generateUUID());
}

std::shared_ptr<Service> App::createService(const std::string& serviceId, const std::string& instanceId)
{
  return m_registry->create(serviceId, instanceId);
}

const ServiceClass* App::findServiceClass(const std::string& serviceId) const
{
  return m_registry->findServiceClass(serviceId);
}

Data App::processRuntimeWithName(const std::string& name, const Data& params) const
{
  std::shared_ptr<Runtime> match;
  {
    std::lock_guard<std::mutex> lock(m_runtimesMutex);
    auto pos = std::find_if(
      m_runtimes.begin(),
      m_runtimes.end(),
      // Among what clients created: a board's runtimes are driven by its
      // coordinator.
      [name](auto rt){ return rt->getName() == name && rt->getSpace().empty(); }
    );
    if (pos != m_runtimes.end())
    {
      match = *pos;
    }
  }

  if (!match)
  {
    std::cout << "App::processRuntimeWithName() Runtime not found" << name << std::endl;
    return Null();
  }

  return match->process(params);
}

unsigned int App::scanForPlugins(const std::string& bundleRoot)
{
  // scan the bundle root for plugins
  namespace fs = std::filesystem;
  if (!fs::exists(bundleRoot) || !fs::is_directory(bundleRoot))
  {
    std::cerr << "App::scanForPlugins: Bundle root does not exist or is not a directory: " << bundleRoot << std::endl;
    return false;
  }
  unsigned int count = 0;
  for (const auto& entry : fs::directory_iterator(bundleRoot))
  {
    if (entry.is_regular_file())
    {
      auto path = entry.path().string();
      if (path.substr(path.find_last_of(".") + 1) == "dll" ||
          path.substr(path.find_last_of(".") + 1) == "so" ||
          path.substr(path.find_last_of(".") + 1) == "dylib")
      {
        std::cout << "App::scanForPlugins: loading plugin: " << path << std::endl;
        if (!loadPlugin(path))
        {
          std::cerr << "App::scanForPlugins: Failed to load plugin: " << path << std::endl;
        }
        else
        {
          std::cout << "App::scanForPlugins: Loaded plugin: " << path << std::endl;
          count++;
        }
      }
    }
  }
  return count;
}

bool App::loadPlugin(const std::string& path)
{
  return m_registry->loadPlugin(path);
}

}
