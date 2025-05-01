#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

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
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{{ "key", m_key }});
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
    
    auto value = next(data);
    m_cache[*key] = value;
    return makeEarlyReturn(value);
  }

private:
  std::string m_key;
  std::map<std::string, Data> m_cache;
};
