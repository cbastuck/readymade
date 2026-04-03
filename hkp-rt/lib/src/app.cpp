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

std::vector<RuntimeConfiguration> App::getRuntimes() const
{
  std::vector<RuntimeConfiguration> configurations;
  for (auto &rt : m_runtimes)
  {
    configurations.push_back(rt->getConfiguration());
  }
  return configurations;
}

std::optional<RuntimeConfiguration> App::getRuntime(const std::string runtimeId) const
{
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return std::nullopt;
  }
  return (*rt)->getConfiguration();
}

bool App::removeRuntime(const std::string &id)
{
  auto before = m_runtimes.size();
  m_runtimes.remove_if([id](auto rt)
                        { return rt->getId() == id; });
  return m_runtimes.size() < before;
}

void App::removeAllRuntimes()
{
  m_runtimes.clear();
}

json App::configureService(const std::string &runtimeId, const std::string &instanceId, json config)
{
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return false;
  }
  return (*rt)->configureService(instanceId, config);
}

json App::getServiceState(const std::string &runtimeId, const std::string &instanceId) const
{
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return false;
  }
  return (*rt)->getServiceState(instanceId);
}

json App::getServices(const std::string &runtimeId) const
{
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return false;
  }
  return (*rt)->getServices();
}

json App::appendService(const std::string& runtimeId, const ServiceConfiguration& service) {
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return false;
  }
  return (*rt)->appendService(service);
}

json App::removeService(const std::string& runtimeId, const std::string& instanceId) {
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return nullptr;
  }
  
  return (*rt)->removeService(instanceId) ?  
    jsonSerialise((*rt)->getConfiguration()) : 
    nullptr;
}

Data App::processRuntime(const std::string& runtimeId, const Data& data)
{
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return false;
  }
  auto result = (*rt)->process(data);
  return result;
}

json App::getRegistry() const
{
  auto r = json::array();
   for (auto svc : m_registry->availableServices()) 
   {
     r.push_back(json{
       { "serviceName", svc.serviceId }, 
       { "serviceId", svc.serviceId },
       { "capabilities", svc.capabilities }});
   }
  return r;
}

std::list<std::shared_ptr<Runtime>>::iterator App::findRuntime(const std::string& runtimeId)
{
  return std::find_if(
    m_runtimes.begin(), 
    m_runtimes.end(), 
    [runtimeId](auto rt){ return rt->getId() == runtimeId; }
  );
}

std::list<std::shared_ptr<Runtime>>::const_iterator App::findRuntime(const std::string& runtimeId) const
{
  return std::find_if(
    m_runtimes.cbegin(), 
    m_runtimes.cend(), 
    [runtimeId](auto rt){ return rt->getId() == runtimeId; }
  );
}

json App::rearrangeServices(const std::string& runtimeId, const std::vector<std::string>& newOrder)
{
  auto rt = findRuntime(runtimeId);
  if (rt == m_runtimes.end())
  {
    return false;
  }
  auto success = (*rt)->rearrangeServices(newOrder);
  return success ? jsonSerialise((*rt)->getConfiguration()) : nullptr;
}

std::shared_ptr<Runtime> App::appendRuntime(const RuntimeConfiguration& config)
{
  removeRuntime(config.runtimeId); // replace an existing runtime with the same id
  auto rt = std::make_shared<Runtime>(this);
  rt->load(config);
  m_runtimes.push_back(rt); 
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
  auto pos = std::find_if(
    m_runtimes.begin(), 
    m_runtimes.end(), 
    [name](auto rt){ return rt->getName() == name; }
  );

  if (pos == m_runtimes.end())
  {
    std::cout << "App::processRuntimeWithName() Runtime not found" << name << std::endl;
    return Null();
  }

  return (*pos)->process(params);
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