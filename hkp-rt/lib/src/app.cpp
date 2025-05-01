#include <app.h>

#include "./registry.h"
#include "./runtime.h"

namespace hkp 
{

App::App(const std::string& externalIP, unsigned int port) 
    : m_externalAddress(std::make_pair(externalIP, port))
    , m_registry(std::make_unique<Registry>())
{
  
}

App::~App()
{

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
       { "serviceId", svc.serviceId }});
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

const std::string& App::getExternalIP() const 
{
  return m_externalAddress.first;
}

unsigned int App::getExternalPort() const 
{
  return m_externalAddress.second;
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

std::shared_ptr<Service> App::createService(const std::string& serviceId, const std::string& instanceId)
{
  return m_registry->create(serviceId, instanceId);
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

}