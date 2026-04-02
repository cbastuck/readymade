#pragma once

#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <regex>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sha256_openssl.h"
#include "../common/inja.h"
#include "../sub_runtime.h"
#include "../uuid.h"

namespace hkp {

class CacheSubservices : public Service
{
public:
  static std::string serviceId() { return "cache-subservices"; }

  explicit CacheSubservices(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_key, (*buf)["key"]);
      updateIfNeeded(m_outputKey, (*buf)["outputKey"]);
      updateIfNeeded(m_persistRoot, (*buf)["persistRoot"]);
      updateIfNeeded(m_persistMode, (*buf)["persistMode"]);
      updateIfNeeded(m_filenameTemplate, (*buf)["filenameTemplate"]);
      if (updateIfNeeded(m_cacheDuration, (*buf)["cacheDuration"]))
      {
        m_maxAge = parseCacheDuration(m_cacheDuration);
      }
      if (updateIfNeeded(m_excluded, (*buf)["excluded"]))
      {
        updateExcludedRegex();
      }

      if (buf->contains("pipeline") && (*buf)["pipeline"].is_array())
      {
        m_subserviceConfig.clear();
        for (const auto& cfg : (*buf)["pipeline"])
        {
          m_subserviceConfig.push_back(cfg);
        }
        rebuildSubservices();
      }
      else if (buf->contains("appendService"))
      {
        auto svcCfg = (*buf)["appendService"];
        if (!svcCfg.contains("instanceId") || svcCfg["instanceId"].get<std::string>().empty())
        {
          svcCfg["instanceId"] = generateUUID();
        }
        syncSubserviceStates();
        m_subserviceConfig.push_back(std::move(svcCfg));
        rebuildSubservices();
      }
      else if (buf->contains("removeService") && (*buf)["removeService"].is_string())
      {
        const std::string id = (*buf)["removeService"].get<std::string>();
        syncSubserviceStates();
        m_subserviceConfig.erase(
          std::remove_if(m_subserviceConfig.begin(), m_subserviceConfig.end(),
            [&id](const json& cfg) { return cfg.value("instanceId", "") == id; }),
          m_subserviceConfig.end()
        );
        rebuildSubservices();
      }
      else if (buf->contains("configureService") && (*buf)["configureService"].is_object())
      {
        const auto& cfg = (*buf)["configureService"];
        if (cfg.contains("instanceId") && cfg.contains("state") && m_subservices)
        {
          const std::string id = cfg["instanceId"].get<std::string>();
          for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
          {
            if ((*it)->getId() == id)
            {
              (*it)->configure(cfg["state"]);
              syncSubserviceStates();
              break;
            }
          }
        }
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
    json pipeline = json::array();
    if (m_subservices)
    {
      for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
      {
        const auto& svc = *it;
        pipeline.push_back(json{
          {"serviceId", svc->getServiceId()},
          {"instanceId", svc->getId()},
          {"state", svc->getState()}
        });
      }
    }

    return Service::mergeStateWith(json{
      {"key", m_key},
      {"outputKey", m_outputKey},
      {"persistRoot", m_persistRoot},
      {"persistMode", m_persistMode},
      {"filenameTemplate", m_filenameTemplate},
      {"cacheDuration", m_cacheDuration},
      {"excluded", m_excluded},
      {"pipeline", pipeline}
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

    if (m_persistMode == "filename" && !m_persistRoot.empty() && !forcedUpdate)
    {
      const std::filesystem::path inPath(*key);
      std::string lookupName;
      if (!m_filenameTemplate.empty())
      {
        json ctx = *j;
        ctx["filename"] = inPath.filename().string();
        ctx["stem"] = inPath.stem().string();
        ctx["extension"] = inPath.extension().string();
        lookupName = processInjaTemplate(m_filenameTemplate, ctx);
      }
      else
      {
        lookupName = inPath.filename().string();
      }

      auto candidate = std::filesystem::path(m_persistRoot) / lookupName;
      if (std::filesystem::exists(candidate))
      {
        return makeEarlyReturn(Data(json{{m_outputKey, std::filesystem::absolute(candidate).string()}}));
      }

      auto missValue = processOnMiss(data);
      if (!isNull(missValue))
      {
        if (auto mixed = getMixedDataFromData(missValue))
        {
          if (!mixed->binary.empty())
          {
            std::ofstream file(candidate, std::ios::binary);
            if (file)
            {
              file.write(reinterpret_cast<const char*>(mixed->binary.data()), mixed->binary.size());
            }
          }
        }
        else if (auto bin = getBinaryFromData(missValue))
        {
          std::ofstream file(candidate, std::ios::binary);
          if (file)
          {
            file.write(reinterpret_cast<const char*>(bin->data()), bin->size());
          }
        }
        else if (auto str = getStringFromData(missValue))
        {
          std::ofstream file(candidate);
          if (file)
          {
            file << *str;
          }
        }
        else if (auto jResult = getJSONFromData(missValue))
        {
          std::ofstream file(candidate);
          if (file)
          {
            file << jResult->dump();
          }
        }
      }
      if (!isNull(missValue) && std::filesystem::exists(candidate))
      {
        return makeEarlyReturn(Data(json{{m_outputKey, std::filesystem::absolute(candidate).string()}}));
      }
      return makeEarlyReturn(missValue);
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

    auto value = processOnMiss(data);
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

protected:
  bool supportsSubservices() const override { return true; }

private:
  Data processOnMiss(Data data)
  {
    Data input = data;
    if (m_subservices && !m_subservices->empty())
    {
      input = m_subservices->process(input);
    }
    return next(input);
  }

  void syncSubserviceStates()
  {
    if (!m_subservices)
    {
      return;
    }

    for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
    {
      const auto& svc = *it;
      for (auto& cfg : m_subserviceConfig)
      {
        if (cfg.value("instanceId", "") == svc->getId())
        {
          cfg["state"] = svc->getState();
          break;
        }
      }
    }
  }

  void rebuildSubservices()
  {
    json arr = json::array();
    for (const auto& cfg : m_subserviceConfig)
    {
      arr.push_back(cfg);
    }
    m_subservices = createSubRuntime(arr);
  }

  void updateExcludedRegex()
  {
    m_excludedRegex.clear();
    for (const auto& pattern : m_excluded)
    {
      try {
        m_excludedRegex.emplace_back(pattern);
      }
      catch (const std::regex_error&) {
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

      return std::chrono::hours(value);
    }
    catch (...) {
      return std::chrono::hours(48);
    }
  }

  std::string m_key;
  std::string m_outputKey = "path";
  std::string m_persistRoot;
  std::string m_persistMode;
  std::string m_filenameTemplate;
  std::map<std::string, Data> m_cache;
  std::string m_cacheDuration;
  std::chrono::hours m_maxAge;
  std::vector<std::string> m_excluded;
  std::vector<std::regex> m_excludedRegex;

  std::shared_ptr<SubRuntime> m_subservices;
  std::vector<json> m_subserviceConfig;
};

} // namespace hkp