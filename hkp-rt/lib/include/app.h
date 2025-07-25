#pragma once

#include <list>
#include <vector>
#include <chrono>

#include <boost/asio.hpp>


#include <types/types.h>
#include <types/validation.h>

namespace hkp 
{

class Service;
class Registry;
class Runtime;

class App
{
public:
  App(const std::string& externalIP = "127.0.0.1", unsigned int port = 5556);
  ~App();

  // TODO: are not strictly associated with app but the server using the app
  const std::string& getExternalIP() const;
  unsigned int getExternalPort() const;

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
private:
  std::list<std::shared_ptr<Runtime>>::iterator findRuntime(const std::string& runtimeId);
  std::list<std::shared_ptr<Runtime>>::const_iterator findRuntime(const std::string& runtimeId) const;

  std::shared_ptr<Runtime> appendRuntime(const RuntimeConfiguration& config);

  void startEventLoop();
  void stopEventLoop();
private:
  std::list<std::shared_ptr<Runtime>> m_runtimes;
  std::pair<std::string, unsigned int> m_externalAddress;
  std::unique_ptr<Registry> m_registry;
  boost::asio::io_context m_io;
  boost::asio::executor_work_guard<boost::asio::io_context::executor_type> m_work_guard;
  std::thread m_eventThread;
};

}