#pragma once

#include <iostream>
#include <fstream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sha256_openssl.h"

class Cache : public hkp::Service 
{
public:
  static std::string serviceId() { return "cache"; }

  Cache(const std::string& instanceId)
     : hkp::Service(instanceId, serviceId())
  { 
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_key, (*buf)["key"]);
      updateIfNeeded(m_persistRoot, (*buf)["persistRoot"]);
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "key", m_key },
      { "persistRoot", m_persistRoot }
    });
  }

  Data process(Data data) override
  {
    auto j = getJSONFromData(data);
    if (!j)
    {
      return Null();
    }
    auto key = getProperty<std::string>(*j, m_key);
    if (!key)
    {
      return data;
    }

    auto pos = m_cache.find(*key);
    if (pos != m_cache.end())
    {
      return makeEarlyReturn(pos->second);
    }

    if (!m_persistRoot.empty())
    {
      auto sha = sha256(*key);
      auto path = m_persistRoot + "/" + sha;
      if (std::filesystem::exists(path))
      {
        std::ifstream file(path);
        if (file)
        {
          std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
          auto value = Data(json::parse(content));
          m_cache[*key] = value;
          return makeEarlyReturn(value);
        }
      }
    }
    
    auto value = next(data);
    m_cache[*key] = value;

    if (!m_persistRoot.empty())
    {
      auto sha = sha256(*key);
      auto path = m_persistRoot + "/" + sha;
      std::ofstream file(path);
      if (file)
      {
        file << stringify(value);
      }
    }

    return makeEarlyReturn(value);
  }

private:
  std::string m_key;
  std::map<std::string, Data> m_cache;
  std::string m_persistRoot;
};
