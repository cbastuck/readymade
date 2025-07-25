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

Runtime::Runtime(OwnsMe<App> app, const std::string& runtimeId, const std::string& runtimeName)
  : m_app(app)
  , m_runtimeId(runtimeId)
  , m_runtimeName(runtimeName)
  , m_websocket(std::make_unique<WebsocketServer>(
      WebsocketConfig::withHost("0.0.0.0").withPath("/" + runtimeId).withRandomPort(),
      [this](boost::beast::flat_buffer& buffer, bool isBinary){ 
        if (isBinary)
        {
          // TODO: assume it's a FloatRingBuffer binary data
          // This is just for testing, we should not assume this
          auto data = std::make_shared<FloatRingBuffer>(m_runtimeId + "-binary");
          auto size = buffer.size();
          FloatRingBuffer::createFromSerialised(buffer, size, *data);
          try 
          {
            this->process(data);
          } 
          catch (const std::exception& e) 
          {
            std::cerr << "Runtime::Runtime.onWebsocket Failed to process incoming binary buffer: " << e.what() << std::endl;
          }
        }
        else
        {
          auto data = boost::beast::buffers_to_string(buffer.data()); // handle JSON data
          json msg;
          try 
          {
            msg = json::parse(data);
          }
          catch (const std::exception& e) 
          {
            std::cerr << "Runtime::Runtime.onWebsocket Failed to process incoming data: " << e.what() << std::endl;
          }
          try
          {
            if (!msg.is_object())
            {
              std::cerr << "Runtime::m_websocket::onSessionData: Invalid JSON object received" << data << std::endl;
              return;
            }
            this->onSessionData(msg);
          }
          catch (const std::exception& e)
          {
            std::cerr << "Runtime::Runtime.onWebsocket Failed to process incoming JSON message: " << e.what() << std::endl;
          }
        }
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

  if (!config.boardName.empty())
  {
    m_boardName = config.boardName;
  }
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
  config.boardName = m_boardName;

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

void Runtime::sendData(Data data)
{
  // do not send directly, but schedule the notification to be sent
  // writing to websocket is not thread-safe
  m_app->postCallback([this, data]() {
    if (m_websocket)
    {
      m_websocket->send(data);
    }
  });   
}

Data Runtime::process(Data data)
{
  onProcessBegin();
  if (m_services.empty())
  {
    return data;
  }
  auto result = processFrom(*m_services.front(), data, false);
  return onProcessEnd(result);
}

Data Runtime::processFrom(const Service &service, Data data, bool advanceBefore)
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
    data = (*next)->startProcess(data);
    if (isNull(data)) // stop processing on null
    {
      return onProcessEnd(data);
    }
    if (isEarlyReturn(data))
    {
      return onProcessEnd(getControlFlowData(data));
    }
  }
  return onProcessEnd(data);;
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

void Runtime::onProcessBegin()
{
  m_processContext.increment();
}

const Data& Runtime::onProcessEnd(const Data& data)
{
  if (m_processContext.decrement() == 0)
  {  
    // if we are the last initiator, we should communicate the result
    if (!m_boardName.empty())
    {
      auto j = getJSONFromData(data);
      if (j)
      {
        sendData(
          json{
            {"type", "result"},
            {"runtimeId", m_runtimeId},
            {"boardName", m_boardName},
            {"data", *j}
          }
        );
      }
      else
      {
        // std::cout << "Runtime::onProcessEnd: non JSON data us not supported: " << stringify(data) << std::endl;
        sendData(data);
      }
    }
  }
  return data;
}

void Runtime::onSessionData(json msg)
{
  if (msg["type"] != "processRuntime")
  {
    std::cout << "Runtime::onSessionData: unsupported message type: " << msg["type"] << std::endl;
    return;
  }
  auto data = msg["params"];
  if (data.is_null())
  {
    std::cout << "Runtime::onSessionData: received null data: " << msg.dump() << std::endl;
    return;
  }
  process(data);
}

}
