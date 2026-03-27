#pragma once

#include <list>
#include <vector>
#include <chrono>

#include <boost/asio.hpp>

#include "./registry.h"
#include <types/types.h>
#include <types/validation.h>

namespace hkp 
{

class Service;
class Runtime;
class Server;

class App
{
public:
  App();
  ~App();

  RuntimeConfiguration createRuntime(json config);
  RuntimeConfiguration createRuntime(RuntimeConfiguration config);

  std::vector<RuntimeConfiguration> getRuntimes() const;
  std::optional<RuntimeConfiguration> getRuntime(const std::string runtimeId) const;

  bool removeRuntime(const std::string &id);
  void removeAllRuntimes();

  json configureService(const std::string &runtimeId, const std::string &instanceId, json config);
  json getServiceState(const std::string &runtimeId, const std::string &instanceId) const;
  json getServices(const std::string &runtimeId) const;
  json appendService(const std::string& runtimeId, const ServiceConfiguration& service);
  json removeService(const std::string& runtimeId, const std::string& instanceId);
  Data processRuntime(const std::string& runtimeId, const Data& data);
  json getRegistry() const;

  json rearrangeServices(const std::string& runtimeId, const std::vector<std::string>& newOrder);

  std::shared_ptr<Service> createService(const std::string& serviceId);
  std::shared_ptr<Service> createService(const std::string& serviceId, const std::string& instanceId);
  
  Data processRuntimeWithName(const std::string& name, const Data& params) const;

  void postCallback(std::function<void()> callback);

  void setServer(Server* server) { m_server = server; }
  Server* getServer() const { return m_server; }
  
  template<typename T>
  void registerService() { m_registry->registerService<T>(); }

  unsigned int scanForPlugins(const std::string& bundleRoot);
  bool loadPlugin(const std::string& path);
  
private:
  std::list<std::shared_ptr<Runtime>>::iterator findRuntime(const std::string& runtimeId);
  std::list<std::shared_ptr<Runtime>>::const_iterator findRuntime(const std::string& runtimeId) const;

  std::shared_ptr<Runtime> appendRuntime(const RuntimeConfiguration& config);

  void startEventLoop();
  void stopEventLoop();
private:
  std::list<std::shared_ptr<Runtime>> m_runtimes;
  std::unique_ptr<Registry> m_registry;
  boost::asio::io_context m_io;
  boost::asio::executor_work_guard<boost::asio::io_context::executor_type> m_work_guard;
  std::thread m_eventThread;
  Server* m_server = nullptr;
};

}
