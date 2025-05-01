#include "./runtime.h"

#include <fstream>
#include <boost/beast.hpp>

#include "./app.h"
#include "./registry.h"
#include "./service.h"
#include "./common/websocket_server.h"

#include <types/validation.h>
#include "common.h"

namespace hkp
{

Runtime::Runtime(OwnsMe<hkp::App> app, const std::string& runtimeId, const std::string& runtimeName)
  : m_app(app)
  , m_runtimeId(runtimeId)
  , m_runtimeName(runtimeName)
  , m_websocket(std::make_unique<WebsocketServer>(
      WebsocketConfig::withHost("0.0.0.0").withPath("/" + runtimeId).withRandomPort(),
      [this](boost::beast::flat_buffer& buffer, bool isBinary){ 
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

  for (auto &svc : m_services)
  {
    ServiceConfiguration sc;
    sc.serviceId = svc->getServiceId();
    sc.instanceId = svc->getId();
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
    s.update(json{{"state", svc->getState()}});
    services.push_back(s);
  }
  return services; 
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
    if (isEarlyReturn(data))
    {
      return getControlFlowData(data);
    }
  }
  return data;
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
  return replaceAll(url, "0.0.0.0", m_app->getExternalIP());
}

std::string Runtime::getRuntimeUrl() const
{
  return m_app->getExternalIP() + ":" + std::to_string(m_app->getExternalPort()) + "/runtimes/" + m_runtimeId;
}

}
