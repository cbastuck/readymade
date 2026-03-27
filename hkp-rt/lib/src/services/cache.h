#pragma once

#include <iostream>
#include <fstream>
#include <regex>
#include <filesystem>
#include <chrono>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sha256_openssl.h"

namespace hkp {

class Cache : public Service 
{
public:
  static std::string serviceId() { return "cache"; }

  Cache(const std::string& instanceId)
     : Service(instanceId, serviceId())
  { 
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_key, (*buf)["key"]);
      updateIfNeeded(m_persistRoot, (*buf)["persistRoot"]);
      if (updateIfNeeded(m_cacheDuration, (*buf)["cacheDuration"]))
      {
        m_maxAge = parseCacheDuration(m_cacheDuration);
      }
      if (updateIfNeeded(m_excluded, (*buf)["excluded"]))
      {
        updateExcludedRegex();
      }
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
      { "persistRoot", m_persistRoot },
      { "cacheDuration", m_cacheDuration },
      { "excluded", m_excluded }
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

    for (const auto& re : m_excludedRegex)
    {
      if (std::regex_search(*key, re))
      {
        return data;
      }
    }
    
    bool forcedUpdate = false;
    auto maxAge = m_maxAge;
    auto cacheOptions = getProperty<json>(*j, "cacheOptions");
    bool noCache = false;
    if (cacheOptions)
    {
      auto cacheStrategy = getProperty<std::string>(*cacheOptions, "strategy");
      if (cacheStrategy)
      {
        if (*cacheStrategy == "no-cache" || *cacheStrategy == "force-update")
        {
          forcedUpdate = true;
          noCache = true;
        }
        else if (*cacheStrategy == "max-age")
        {
          auto maxAgeOverride = getProperty<std::string>(*cacheOptions, "value");
          if (maxAgeOverride)
          {
            maxAge = parseCacheDuration(*maxAgeOverride);
          }
        }
      }
    }

    if (!forcedUpdate && !noCache)
    {
      auto pos = m_cache.find(*key);
      if (pos != m_cache.end())
      {
        return makeEarlyReturn(pos->second);
      }
    }

    if (!noCache && !forcedUpdate && !m_persistRoot.empty())
    {
      auto sha = sha256(*key);
      auto path = m_persistRoot + "/" + sha;
      if (std::filesystem::exists(path))
      {
        // Check if file is not older than cache duration
        auto lastWriteTime = std::filesystem::last_write_time(path);
        auto fileAge = std::chrono::file_clock::now() - lastWriteTime;
        if (maxAge == std::chrono::hours::zero() || fileAge <= maxAge)
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
    }
    
    auto value = next(data);
    if (isNull(value))
    {
        return value;
    }

    if (!noCache)
    {
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
    }
    

    return makeEarlyReturn(value);
  }

private:
  void updateExcludedRegex()
  {
    m_excludedRegex.clear();
    for (const auto& pattern : m_excluded)
    {
      try {
        m_excludedRegex.emplace_back(pattern);
      }
      catch (const std::regex_error&) {
        // Skip invalid regex patterns
      }
    }
  }

  std::chrono::hours parseCacheDuration(const std::string& duration) const
  {
    if (duration.empty())
    {
      return std::chrono::hours::zero();
    }

    try {
      size_t value = 0;
      size_t idx = 0;
      value = std::stoul(duration, &idx);

      if (idx < duration.length())
      {
        char unit = duration[idx];
        if (unit == 'h' || unit == 'H')
        {
          return std::chrono::hours(value);
        }
        else if (unit == 'd' || unit == 'D')
        {
          return std::chrono::hours(value * 24);
        }
        else if (unit == 'm' || unit == 'M')
        {
          return std::chrono::hours(value / 60);
        }
      }
      
      // No unit specified, assume hours
      return std::chrono::hours(value);
    }
    catch (...) {
      return std::chrono::hours(48); // Fallback to default
    }
  }

  std::string m_key;
  std::map<std::string, Data> m_cache;
  std::string m_persistRoot;
  std::string m_cacheDuration;
  std::chrono::hours m_maxAge;
  std::vector<std::string> m_excluded;
  std::vector<std::regex> m_excludedRegex;
};

}
