#pragma once

#include <list>
#include <vector>
#include <chrono>

#include <types/types.h>

#include "./registry.h"
#include "./runtime.h"
#include "types/validation.h"

class App
{
public:
  App() : m_registry(json::array())
  {
    for (auto svc : Registry::availableServices()) 
    {
      m_registry.push_back(json{
        { "serviceName", svc.serviceId }, 
        { "serviceId", svc.serviceId }});
    }
  }

  RuntimeConfiguration createRuntime(json config)
  {
    auto validatedConfig = validateRuntime(config);
    if (!validatedConfig) 
    {
      throw std::runtime_error("RuntimeConfiguration::createRuntime config validation failed");
    }
    return createRuntime(*validatedConfig);
  }

  RuntimeConfiguration createRuntime(RuntimeConfiguration config)
  {
    auto runtime = appendRuntime(config); 
    return runtime->getConfiguration();
  }

  std::vector<RuntimeConfiguration> getRuntimes() const
  {
    std::vector<RuntimeConfiguration> configurations;
    for (auto &rt : m_runtimes)
    {
      configurations.push_back(rt->getConfiguration());
    }
    return configurations;
  }

  std::optional<RuntimeConfiguration> getRuntime(const std::string runtimeId) const
  {
    auto rt = findRuntime(runtimeId);
    if (rt == m_runtimes.end())
    {
      return std::nullopt;
    }
    return (*rt)->getConfiguration();
  }

  bool removeRuntime(const std::string &id)
  {
    auto before = m_runtimes.size();
    m_runtimes.remove_if([id](auto rt)
                         { return rt->getId() == id; });
    return m_runtimes.size() < before;
  }

  void removeAllRuntimes()
  {
    m_runtimes.clear();
  }

  json configureService(const std::string &runtimeId, const std::string &instanceId, json config)
  {
    auto rt = findRuntime(runtimeId);
    if (rt == m_runtimes.end())
    {
      return false;
    }
    return (*rt)->configureService(instanceId, config);
  }

  json getRegistry() const
  {
    return m_registry;
  }

  std::list<std::shared_ptr<Runtime>>::iterator findRuntime(const std::string& runtimeId)
  {
    return std::find_if(
      m_runtimes.begin(), 
      m_runtimes.end(), 
      [runtimeId](auto rt){ return rt->getId() == runtimeId; }
    );
  }

  std::list<std::shared_ptr<Runtime>>::const_iterator findRuntime(const std::string& runtimeId) const
  {
    return std::find_if(
      m_runtimes.cbegin(), 
      m_runtimes.cend(), 
      [runtimeId](auto rt){ return rt->getId() == runtimeId; }
    );
  }

private:
  std::shared_ptr<Runtime> appendRuntime(const RuntimeConfiguration& config)
  {
    removeRuntime(config.runtimeId);
    auto rt = std::make_shared<Runtime>();
    rt->load(config);
    m_runtimes.push_back(rt); 
    return rt;
  }

private:
  std::list<std::shared_ptr<Runtime>> m_runtimes;
  json m_registry;
};