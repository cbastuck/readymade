#pragma once

#include <chrono>
#include <filesystem>
#include <iostream>
#include <regex>
#include <vector>

#include <files.h>
#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sha256_openssl.h"
#include "../common/inja.h"
#include "../sub_runtime.h"
#include "../uuid.h"

/**
 * Service Documentation
 * Service ID: cache-subservices
 * Service Name: CacheSubservices
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 *
 * `persistRoot` lies inside a folder this server gives boards, and a file
 * name made from the input stays inside `persistRoot` (files.h). A root
 * outside them leaves the cache in memory.
 */
namespace hkp {

class CacheSubservices : public Service
{
public:
  static std::string serviceId() { return "cache-subservices"; }
  static std::vector<std::string> capabilities() { return {"subservices"}; }

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

    const auto persistFolder = persistRoot();
    if (m_persistMode == "filename" && persistFolder && !forcedUpdate)
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

      std::string problem;
      const auto candidate = files::resolveIn(*persistFolder, lookupName, problem);
      if (!candidate)
      {
        std::cerr << "Cache service: " << problem << std::endl;
        return makeEarlyReturn(processOnMiss(data));
      }
      if (files::exists(*candidate))
      {
        return makeEarlyReturn(Data(json{{m_outputKey, candidate->string()}}));
      }

      auto missValue = processOnMiss(data);
      if (!isNull(missValue))
      {
        if (auto mixed = getMixedDataFromData(missValue))
        {
          if (!mixed->binary.empty())
          {
            auto file = files::output(*candidate, std::ios::binary);
            if (file)
            {
              file.write(reinterpret_cast<const char*>(mixed->binary.data()), mixed->binary.size());
            }
          }
        }
        else if (auto bin = getBinaryFromData(missValue))
        {
          auto file = files::output(*candidate, std::ios::binary);
          if (file)
          {
            file.write(reinterpret_cast<const char*>(bin->data()), bin->size());
          }
        }
        else if (auto str = getStringFromData(missValue))
        {
          auto file = files::output(*candidate, std::ios::trunc);
          if (file)
          {
            file << *str;
          }
        }
        else if (auto jResult = getJSONFromData(missValue))
        {
          auto file = files::output(*candidate, std::ios::trunc);
          if (file)
          {
            file << jResult->dump();
          }
        }
      }
      if (!isNull(missValue) && files::exists(*candidate))
      {
        return makeEarlyReturn(Data(json{{m_outputKey, candidate->string()}}));
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

    if (!noCache && !forcedUpdate && persistFolder)
    {
      std::string problem;
      const auto path = files::resolveIn(*persistFolder, sha256(*key), problem);
      if (path && files::exists(*path))
      {
        auto lastWriteTime = std::filesystem::last_write_time(path->path());
        auto fileAge = std::chrono::file_clock::now() - lastWriteTime;
        if (maxAge == std::chrono::hours::zero() || fileAge <= maxAge)
        {
          auto file = files::input(*path, {});
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

      std::string problem;
      const auto path = persistFolder ? files::resolveIn(*persistFolder, sha256(*key), problem) : std::nullopt;
      if (path)
      {
        auto file = files::output(*path, std::ios::trunc);
        if (file)
        {
          file << stringify(value);
        }
      }
    }

    return makeEarlyReturn(value);
  }


private:
  // persistRoot, inside a folder this server gives boards; nothing when it is
  // unset or outside them, and the cache then keeps to memory. Resolved on
  // every input, since the folders may change while it runs; a refusal is
  // logged once, not once per input.
  std::optional<files::Path> persistRoot() const
  {
    if (m_persistRoot.empty())
    {
      return std::nullopt;
    }
    std::string problem;
    auto folder = files::resolve(m_persistRoot, problem);
    if (!folder && problem != m_persistProblem)
    {
      std::cerr << "Cache service: " << problem << std::endl;
    }
    m_persistProblem = problem;
    return folder;
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
  mutable std::string m_persistProblem; // the refusal last logged
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