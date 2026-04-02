#pragma once

#include <list>

#include <types/types.h>
#include <types/message.h>

#include "./uuid.h"
#include "./process_context.h"
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
  json getServiceState(const std::string &instanceId) const;
  json getServices() const;

  Data process(Data data, json context = nullptr);

  // ── RuntimeHost overrides ────────────────────────────────────────────────
  Data processFrom(const Service &service, Data data, bool advanceBefore=true, std::function<void(Data)> callback = nullptr) override;
  void scheduleProcessFrom(const Service &service, Data data, bool advanceBefore=true) override;
  bool isConnected(const Service &svc) const override;
  void sendData(Data data, MessagePurpose purpose, const std::string& sender, std::function<void(Data)> callback = nullptr) override;

  // Create a SubRuntime from a JSON array of service-config objects.
  // Services are parented to the SubRuntime (not this Runtime) so that
  // next() / nextAsync() work correctly inside the nested pipeline.
  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override;

  void processScheduled();

  json appendService(const ServiceConfiguration& newService);
  bool insertService(std::shared_ptr<Service> newService, std::shared_ptr<Service> predecessor = nullptr);
  bool removeService(const std::string& instanceId);

  bool rearrangeServices(const std::vector<std::string>& newOrder);

  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId);
  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId) const;

  inline const std::string &getId() const { return m_runtimeId; }
  inline const std::string &getName() const { return m_runtimeName; }

  inline void setBoardName(const std::string &name) { m_boardName = name; }
  inline const std::string& getBoardName() const { return m_boardName; } 

private:
  std::string replaceHostWithExternalAddress(std::string url) const;
  std::string getRuntimeUrl() const;

  void onProcessBegin();
  const Data& onProcessEnd(const Data& result, json context = nullptr, std::function<void(Data)> callback = nullptr);

  void onSessionJSONData(json msg);
  void onSessionBinaryData(Data data, MessageHeader header);
  
  bool storePendingCallback(const std::string& requestId, std::function<void(Data)> callback);
  std::function<void(Data)> findAndRemovePendingCallback(const std::string& requestId);

private:
  OwnsMe<App> m_app;
  std::string m_runtimeId;
  std::string m_runtimeName;
  std::string m_boardName;
  std::list<std::shared_ptr<Service>> m_services; // TODO: not thread safe
  std::unique_ptr<WebsocketServer> m_websocket;
  std::vector<RuntimeInput> m_inputs;
  ProcessContext m_processContext;
  std::array<std::function<void()>, 100> m_scheduledProcesses;

  struct PendingResolve {
    std::string requestId;
    std::function<void(Data)> callback;
  };
  std::array<PendingResolve, 8> m_pendingResolve;
};

}