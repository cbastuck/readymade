#pragma once

#include <iostream>
#include <regex>
#include <filesystem>
#include <chrono>

#include <files.h>
#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "./sha256_openssl.h"
#include "../common/inja.h"

/**
 * Service Documentation
 * Service ID: cache
 * Service Name: Cache
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
      { "outputKey", m_outputKey },
      { "persistRoot", m_persistRoot },
      { "persistMode", m_persistMode },
      { "filenameTemplate", m_filenameTemplate },
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

    // ── "filename" persist mode ────────────────────────────────────────────
    // persistMode "filename": treat m_key as a path, derive a lookup filename
    // (optionally via an inja filenameTemplate), check persistRoot for it, and
    // early-return {"path":"<absolute>"} on hit.  On miss, call next(), persist
    // the result, then return the same shape.
    // The default "sha" mode (or no persistMode set) falls through to the
    // existing SHA-based logic below — existing configs are unaffected.
    const auto persistFolder = persistRoot();
    if (m_persistMode == "filename" && persistFolder && !forcedUpdate)
    {
      const std::filesystem::path inPath(*key);
      std::string lookupName;
      if (!m_filenameTemplate.empty())
      {
        // Build a template context from the incoming JSON plus path-derived
        // helpers: {{ filename }}, {{ stem }}, {{ extension }}
        json ctx = *j;
        ctx["filename"]  = inPath.filename().string();
        ctx["stem"]      = inPath.stem().string();
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
        return makeEarlyReturn(next(data));
      }
      if (files::exists(*candidate))
      {
        return makeEarlyReturn(Data(json{{m_outputKey, candidate->string()}}));
      }

      auto result = next(data);
      if (!isNull(result))
      {
        if (auto mixed = getMixedDataFromData(result))
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
        else if (auto bin = getBinaryFromData(result))
        {
          auto file = files::output(*candidate, std::ios::binary);
          if (file)
          {
            file.write(reinterpret_cast<const char*>(bin->data()), bin->size());
          }
        }
        else if (auto str = getStringFromData(result))
        {
          auto file = files::output(*candidate, std::ios::trunc);
          if (file)
          {
             file << *str;
          }
           
        }
        else if (auto jResult = getJSONFromData(result))
        {
          auto file = files::output(*candidate, std::ios::trunc);
          if (file) 
          {
            file << jResult->dump();
          }
        }
      }
      if (!isNull(result) && files::exists(*candidate))
      {
        return makeEarlyReturn(Data(json{{m_outputKey, candidate->string()}}));
      }
      return makeEarlyReturn(result);
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
        // Check if file is not older than cache duration
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
    
    auto value = next(data);
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
  // unset or outside them, and the cache then keeps to memory.
  std::optional<files::Path> persistRoot() const
  {
    if (m_persistRoot.empty())
    {
      return std::nullopt;
    }
    std::string problem;
    auto folder = files::resolve(m_persistRoot, problem);
    if (!folder)
    {
      std::cerr << "Cache service: " << problem << std::endl;
    }
    return folder;
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
  std::string m_outputKey  = "path"; // defaults to "path" for backward compatibility
  std::string m_persistRoot;
  std::string m_persistMode; // "sha" (default) | "filename"
  std::string m_filenameTemplate;
  std::map<std::string, Data> m_cache;
  std::string m_cacheDuration;
  std::chrono::hours m_maxAge;
  std::vector<std::string> m_excluded;
  std::vector<std::regex> m_excludedRegex;
};

}
