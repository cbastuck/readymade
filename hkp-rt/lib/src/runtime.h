#pragma once

#include <list>

#include <types/types.h>
#include <types/message.h>

#include "./uuid.h"
#include "./process_context.h"

namespace hkp
{

class App;
class Service;
class WebsocketServer;
class RuntimeConfiguration;

class Runtime
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
  void sendData(Data data, MessagePurpose purpose, const std::string& sender);

  Data process(Data data);
  Data processFrom(const Service &service, Data data, bool advanceBefore=true);
  void scheduleProcessFrom(const Service &service, Data data, bool advanceBefore=true);
  void processScheduled();
  bool isConnected(const Service &svc) const;

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
  const Data& onProcessEnd(const Data& result);

  void onSessionData(json msg);

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
};

}