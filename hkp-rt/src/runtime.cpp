#include "./runtime.h"

#include <fstream>

#include "./app.h"
#include "./registry.h"
#include "./service.h"
#include "./common/websocket_server.h"

#include <types/validation.h>

Runtime::Runtime(OwnsMe<App> app, const std::string& runtimeId, const std::string& runtimeName)
  : m_app(app)
  , m_runtimeId(runtimeId)
  , m_runtimeName(runtimeName)
  , m_websocket(std::make_unique<WebsocketServer>(
      WebsocketConfig::withHost("0.0.0.0").withPath("/" + runtimeId).withRandomPort(),
      [this](beast::flat_buffer& buffer, bool isBinary){ 
        std::cout << "Websocket::onSessionData" << std::endl; 
      })
    )
{
  m_websocket->start();
    
  std::cout << "Bound to port: " << m_websocket->getBoundPort() << std::endl; 
}

Runtime::~Runtime()
{
  m_websocket->stop();
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

  m_runtimeId = config.runtimeId;
  m_runtimeName = config.runtimeName;
  auto services = config.services;
  for (auto &service : services)
  {
    std::string serviceId = service.serviceId;
    std::string instanceId = service.instanceId;
    auto svc = Registry::create(serviceId, instanceId);
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
}

RuntimeConfiguration Runtime::getConfiguration() const
{
  RuntimeConfiguration config;
  config.runtimeId = m_runtimeId;
  config.runtimeName = m_runtimeName; 
  for (auto &svc : m_services)
  {
    ServiceConfiguration sc;
    sc.serviceId = svc->getServiceId();
    sc.instanceId = svc->getId();
    sc.state = svc->getState();
    config.services.push_back(sc);
  }
  config.outputUrl = "ws://" + m_app->getExternalIP() + ":" + std::to_string(m_websocket->getBoundPort()) + "/" + m_runtimeId;
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

void Runtime::onServiceNotification(const std::string &instanceId, Data data)
{
  m_websocket->send(data);
}

Data Runtime::process(Data data)
{
  if (m_services.empty())
  {
    return data;
  }
  return processFrom(*m_services.front(), data, false);
}

Data Runtime::processFrom(const Service &service, Data data, bool advanceBefore)
{
  auto it = findServiceById(service.getId());
  if (it == m_services.cend())
  {
    throw std::runtime_error("Runtime::processNext service not found in runtime");
  }

  for (auto next = advanceBefore ? std::next(it) : it; 
       next != m_services.cend(); 
       ++next)
  {
    data = (*next)->startProcess(data);
    if (isNull(data)) // stop processing on null
    {
      return data;
    }
  }
  return data;
}


json Runtime::appendService(const ServiceConfiguration& newService)
{
  auto svc = Registry::create(newService.serviceId, newService.instanceId);
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