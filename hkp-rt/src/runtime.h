#pragma once

#include <list>

#include <types/types.h>

#include "./uuid.h"

class Service;
class Websocket;
class RuntimeConfiguration;

class Runtime
{
public:
  Runtime(const std::string& runtimeId=generateUUID(), const std::string& runtimeName="");
  ~Runtime();

  void loadFromDisk(const std::string& path);
  void load(const json& buffer);
  void load(const RuntimeConfiguration& config);

  RuntimeConfiguration getConfiguration() const;
  
  json configureService(const std::string &instanceId, json config);
  void onServiceNotification(const std::string &instanceId, Data data);

  Data processNext(const Service &service, Data data) const;
  bool isConnected(const Service &svc) const;

  bool insert(std::shared_ptr<Service> newService, std::shared_ptr<Service> predecessor = nullptr);

  std::list<std::shared_ptr<Service>>::const_iterator findServiceById(const std::string& instanceId);
  std::list<std::shared_ptr<Service>>::const_iterator find(const Service &service) const;

  inline const std::string &getId() const { return m_runtimeId; }
  inline const std::string &getName() const { return m_runtimeName; }

private:
  std::string m_runtimeId;
  std::string m_runtimeName;
  std::list<std::shared_ptr<Service>> m_services;
  std::unique_ptr<Websocket> m_websocket;
};