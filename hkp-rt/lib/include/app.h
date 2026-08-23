#pragma once

#include <list>
#include <memory>
#include <mutex>
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
  // Runs a runtime's pipeline starting at one service; see Runtime::processAt.
  // Throws std::runtime_error when the runtime holds no such service.
  Data processServiceAt(const std::string& runtimeId,
                        const std::string& instanceId, const Data& data);
  json getRegistry() const;

  json rearrangeServices(const std::string& runtimeId, const std::vector<std::string>& newOrder);

  std::shared_ptr<Service> createService(const std::string& serviceId);
  std::shared_ptr<Service> createService(const std::string& serviceId, const std::string& instanceId);
  const ServiceClass* findServiceClass(const std::string& serviceId) const;
  
  Data processRuntimeWithName(const std::string& name, const Data& params) const;

  // Delivers a notification-WebSocket message (raw frame) to the runtime it
  // belongs to. Called by the Server's WS layer once a connection has bound
  // itself to a runtimeId via the protocol handshake.
  void dispatchRuntimeWsMessage(const std::string& runtimeId, const std::string& message, bool isBinary);

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

  // Look a runtime up and return a shared_ptr copy under the lock. Callers then
  // operate on the copy without holding the lock: the copy keeps the Runtime
  // alive even if another thread removes it concurrently, so operations never
  // touch a half-destroyed Runtime. Returns nullptr when not found.
  std::shared_ptr<Runtime> findRuntimeShared(const std::string& runtimeId) const;

  std::shared_ptr<Runtime> appendRuntime(const RuntimeConfiguration& config);

  void startEventLoop();
  void stopEventLoop();
private:
  // Guards the structure of m_runtimes (find/insert/erase) only. Held just long
  // enough to look up or mutate the list — never across a Runtime operation
  // (process/getConfiguration), which run on a shared_ptr copy instead.
  mutable std::mutex m_runtimesMutex;
  std::list<std::shared_ptr<Runtime>> m_runtimes;
  std::unique_ptr<Registry> m_registry;
  boost::asio::io_context m_io;
  boost::asio::executor_work_guard<boost::asio::io_context::executor_type> m_work_guard;
  std::thread m_eventThread;
  Server* m_server = nullptr;
};

}
