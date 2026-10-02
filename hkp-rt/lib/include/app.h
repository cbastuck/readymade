#pragma once

#include <functional>
#include <list>
#include <map>
#include <memory>
#include <mutex>
#include <vector>
#include <chrono>

#include <boost/asio.hpp>

#include "./registry.h"
#include <types/types.h>
#include <types/validation.h>
#include <types/message.h>
#include <log_entry.h>

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
  // The same, as part of a run somebody else began: `context` is what a peer
  // sent (`runId`, `parentRunId`, `requestId`), and anything it leaves out is
  // filled in. See ProcessContext::fromJson.
  Data processRuntime(const std::string& runtimeId, const Data& data, const json& context);
  // Runs a runtime's pipeline starting at one service; see Runtime::processAt.
  // Throws std::runtime_error when the runtime holds no such service.
  Data processServiceAt(const std::string& runtimeId,
                        const std::string& instanceId, const Data& data);
  json getRegistry() const;

  json rearrangeServices(const std::string& runtimeId, const std::vector<std::string>& newOrder);

  // Hand a running runtime values for the references its services hold.
  //
  // Answers with the aliases it then holds, and null when there is no such
  // runtime. Naming them is all that can be asked: there is no route from here
  // back to a value.
  json setRuntimeSecrets(const std::string& runtimeId,
                         const std::map<std::string, SecretEntry>& entries);

  // Hand a running runtime asset descriptors, or null for one deleted. Answers
  // with the ids it then holds, and null when there is no such runtime.
  json setRuntimeAssets(const std::string& runtimeId,
                        const std::map<std::string, nlohmann::json>& entries);

  // Whether an asset resolves on a runtime, and to what — a check, never the
  // content. Null when there is no such runtime.
  json checkRuntimeAsset(const std::string& runtimeId, const std::string& assetId);

  // Changes what a running runtime records — `logging`, `logLevel`, `logData`
  // — without rebuilding it. A field left out is left as it was.
  //
  // Answers with the settings the runtime then has, and null when there is no
  // such runtime.
  json setRuntimeState(const std::string& runtimeId, const json& state);

  // Where a runtime's output also goes, beside the clients watching it.
  //
  // One sink per runtime, replaced by the next and removed by an empty one. It
  // is called on the event loop, with what the runtime hands to the next one
  // (`onData`, under a result purpose), what its services say (`onData`, as a
  // notification from `sender`) and what it records (`onLog`).
  struct RuntimeOutputSink
  {
    std::function<void(const Data&, MessagePurpose, const std::string& sender)> onData;
    std::function<void(const LogEntry&)> onLog;
  };
  void setRuntimeOutputSink(const std::string& runtimeId, RuntimeOutputSink sink);
  void clearRuntimeOutputSink(const std::string& runtimeId);
  // Hands a runtime's output to its sink, when it has one. For the runtime.
  void emitRuntimeData(const std::string& runtimeId, const Data& data,
                       MessagePurpose purpose, const std::string& sender);
  void emitRuntimeLog(const std::string& runtimeId, const LogEntry& entry);

  std::shared_ptr<Service> createService(const std::string& serviceId);
  std::shared_ptr<Service> createService(const std::string& serviceId, const std::string& instanceId);
  const ServiceClass* findServiceClass(const std::string& serviceId) const;
  
  Data processRuntimeWithName(const std::string& name, const Data& params) const;

  // Delivers a notification-WebSocket message (raw frame) to the runtime it
  // belongs to. Called by the Server's WS layer once a connection has bound
  // itself to a runtimeId via the protocol handshake.
  void dispatchRuntimeWsMessage(const std::string& runtimeId, const std::string& message, bool isBinary);

  void postCallback(std::function<void()> callback);
  // The loop `postCallback` posts to, for something that keeps a connection
  // of its own on it.
  boost::asio::io_context& ioContext() { return m_io; }

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
  mutable std::mutex m_sinksMutex;
  std::map<std::string, RuntimeOutputSink> m_sinks;
};

}
