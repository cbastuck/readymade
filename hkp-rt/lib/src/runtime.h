#pragma once

#include <list>
#include <vector>

#include <types/types.h>
#include <types/message.h>

#include "./uuid.h"
#include "./process_context.h"
#include "./process_depth.h"
#include "./runtime_host.h"

namespace hkp
{

class App;
class Service;
class SubRuntime;
class WebsocketServer;
class RuntimeConfiguration;

class Runtime : public RuntimeHost
{
public:
  Runtime(
    OwnsMe<App> owner,
    const std::string& runtimeId=generateUUID(), 
    const std::string& runtimeName="");
  ~Runtime();

  void loadFromDisk(const std::string& path);
  void load(const json& buffer);
  void load(const RuntimeConfiguration& config);

  RuntimeConfiguration getConfiguration() const;
  
  json configureService(const std::string &instanceId, json config);

  // The values for the references this runtime's services carry, held apart
  // from every service's state and reachable only through here.
  SecretVault& secrets() override { return m_vault; }

  // Takes in values for references this runtime's services already hold.
  //
  // Merges rather than replaces, because this is what a client editing one
  // entry sends, and what a client re-pushes after a restart. Replacing on a
  // partial push would strip credentials from services nobody touched.
  void setSecrets(const std::map<std::string, SecretEntry>& entries)
  {
    m_vault.merge(entries);
  }

  json getServiceState(const std::string &instanceId) const;
  json getServices() const;

  Data process(Data data, ProcessContext context = ProcessContext::newRun());

  // Runs the pipeline starting **at** a named service rather than after it.
  //
  // processFrom() exists for a service handing work onward — it means "carry on
  // behind me", so by default it advances past the caller. This is the other
  // question: something outside the pipeline wants one service to do its job
  // with a given payload, and that service must actually run. Throws when the
  // runtime holds no service by that id.
  Data processAt(const std::string& instanceId, Data data,
                 ProcessContext context = ProcessContext::newRun());

  // ── RuntimeHost overrides ────────────────────────────────────────────────
  Data processFrom(const Service &service, Data data, bool advanceBefore=true, std::function<void(Data)> callback = nullptr) override;
  void scheduleProcessFrom(const Service &service, Data data, bool advanceBefore=true) override;
  bool isConnected(const Service &svc) const override;
  void sendData(Data data, MessagePurpose purpose, const std::string& sender, std::function<void(Data)> callback = nullptr) override;
  void notifyProcessFinished(const Service& svc, const Data& data) override;
  void log(const Service& svc, LogLevel level, const std::string& event,
           const nlohmann::json& data = nullptr) override;
  void forwardLog(const LogEntry& entry) override;

  // Where this runtime's entries go. The server registers one to carry them to
  // the board's coordinator.
  void registerLogTarget(std::function<void(const LogEntry&)> target);

  // Whether log entries may carry their `data` payload. Off unless a board
  // turns it on, because `data` is the one free-form field and therefore the
  // only place a service can record something it did not mean to.
  void setLogData(bool enabled) { m_logData = enabled; }
  void setLogging(bool enabled) { m_logging = enabled; }
  void setLogLevel(LogLevel level) { m_logLevel = level; }
  bool isLogging() const { return m_logging; }

  // Create a SubRuntime from a JSON array of service-config objects.
  // Services are parented to the SubRuntime (not this Runtime) so that
  // next() / nextAsync() work correctly inside the nested pipeline.
  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override;

  void processScheduled();

  // Handles a raw notification-WebSocket frame routed here by the Server's WS
  // layer (after the connection bound itself to this runtime via the protocol
  // handshake). Binary frames are YAS-encoded messages; text frames are JSON.
  void onWebSocketMessage(const std::string& message, bool isBinary);

  json appendService(const ServiceConfiguration& newService);
  bool insertService(std::shared_ptr<Service> newService, std::shared_ptr<Service> predecessor = nullptr);
  bool removeService(const std::string& instanceId);

  bool rearrangeServices(const std::vector<std::string>& newOrder);

  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId);
  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId) const;

  inline const std::string &getId() const { return m_runtimeId; }
  /** See RuntimeConfiguration::garbageCollected. False means persist. */
  inline bool isGarbageCollected() const { return m_garbageCollected; }
  inline const std::string &getName() const { return m_runtimeName; }

  inline void setBoardName(const std::string &name) { m_boardName = name; }
  inline const std::string& getBoardName() const { return m_boardName; } 

private:
  std::string replaceHostWithExternalAddress(std::string url) const;
  std::string getRuntimeUrl() const;
  void sendServiceLifecycleNotification(const Service& service, const std::string& state, const Data& data);

  void onProcessBegin();
  const Data& onProcessEnd(const Data& result, ProcessContext context = {}, std::function<void(Data)> callback = nullptr);

  void onSessionJSONData(json msg);
  void onSessionBinaryData(Data data, MessageHeader header);
  
  bool storePendingCallback(const std::string& requestId, std::function<void(Data)> callback);
  std::function<void(Data)> findAndRemovePendingCallback(const std::string& requestId);

private:
  OwnsMe<App> m_app;
  std::string m_runtimeId;
  bool m_garbageCollected = false;
  std::string m_runtimeName;
  std::string m_boardName;
  std::list<std::shared_ptr<Service>> m_services; // TODO: not thread safe
  SecretVault m_vault;
  std::vector<RuntimeInput> m_inputs;
  ProcessDepth m_processDepth;
  // The call being processed right now, so an entry can name its run.
  ProcessContext m_context;
  bool m_hasContext = false;
  bool m_logData = false;
  bool m_logging = false;
  LogLevel m_logLevel = LogLevel::Info;
  std::vector<std::function<void(const LogEntry&)>> m_logTargets;
  std::array<std::function<void()>, 100> m_scheduledProcesses;

  struct PendingResolve {
    std::string requestId;
    std::function<void(Data)> callback;
  };
  std::array<PendingResolve, 8> m_pendingResolve;
};

}