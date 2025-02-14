#pragma once

#include <list>

#include <types/types.h>

#include "./uuid.h"

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
  void onServiceNotification(const std::string &instanceId, Data data);

  Data process(Data data);
  Data processFrom(const Service &service, Data data, bool advanceBefore=true);
  bool isConnected(const Service &svc) const;

  json appendService(const ServiceConfiguration& newService);
  bool insertService(std::shared_ptr<Service> newService, std::shared_ptr<Service> predecessor = nullptr);
  bool removeService(const std::string& instanceId);

  bool rearrangeServices(const std::vector<std::string>& newOrder);

  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId);
  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId) const;

  inline const std::string &getId() const { return m_runtimeId; }
  inline const std::string &getName() const { return m_runtimeName; }

private:
  OwnsMe<App> m_app;
  std::string m_runtimeId;
  std::string m_runtimeName;
  std::list<std::shared_ptr<Service>> m_services; // TODO: not thread safe
  std::unique_ptr<WebsocketServer> m_websocket;
};