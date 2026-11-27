#pragma once

#include <algorithm>
#include <cctype>
#include <functional>
#include <map>
#include <mutex>
#include <optional>
#include <regex>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace hkp {

// Resources a runtime was given, and the one way to their bindings.
//
// A board declares what it needs from outside Readymade — an Ollama server, a
// Postgres database, an S3 bucket — by kind (`ollama`, `postgres`, `s3`), and
// service state names one by reference, `hkp-resource://<id>`, as a whole
// field. getState() echoes the reference, and saving a board writes back what
// was configured: addresses and credentials never enter service state.
//
// The bindings arrive with the runtime's create payload, or on
// POST /runtimes/<id>/resources — and again whenever a binding changes, which
// is the point: a service resolves its reference at the moment it uses it, so
// the next use gets the new binding without anything being reconfigured.
//
// The format matches hkp-frontend/src/runtime/board/resources.ts,
// hkp-node/src/resources.ts and hkp-python/src/hkp/resources.py: a board
// written against one runtime has to open against another.

using ResourceBinding = nlohmann::json;

struct ResourceResolution
{
  // Empty when there is none.
  std::optional<ResourceBinding> resource;
  // Why there is none, or empty when there is.
  std::string problem;
};

inline const std::string& resourceScheme()
{
  static const std::string scheme = "hkp-resource://";
  return scheme;
}

inline bool isResourceId(const std::string& id)
{
  static const std::regex pattern(R"(^[A-Za-z0-9_.\-]+$)");
  return std::regex_match(id, pattern);
}

inline bool isResourceKind(const std::string& kind)
{
  return kind == "ollama" || kind == "postgres" || kind == "s3";
}

inline std::string trimResourceField(std::string value)
{
  const auto notSpace = [](unsigned char c) { return !std::isspace(c); };
  value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
  value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(), value.end());
  return value;
}

// The id a whole-value reference names, or nothing for anything else.
inline std::optional<std::string> parseResourceRef(const std::string& value)
{
  static const std::regex pattern(R"(^hkp-resource://([A-Za-z0-9_.\-]+)$)");
  std::smatch match;
  if (std::regex_match(value, match, pattern))
  {
    return match[1].str();
  }
  return std::nullopt;
}

inline std::optional<std::string> parseResourceRef(const nlohmann::json& value)
{
  return value.is_string() ? parseResourceRef(value.get<std::string>()) : std::nullopt;
}

// Every resource id a value mentions, however deeply it is nested.
inline void findResourceRefs(const nlohmann::json& value, std::vector<std::string>& into)
{
  static const std::regex pattern(R"(hkp-resource://([A-Za-z0-9_.\-]+))");
  if (value.is_string())
  {
    const auto text = value.get<std::string>();
    for (std::sregex_iterator it(text.begin(), text.end(), pattern), end; it != end; ++it)
    {
      const auto id = (*it)[1].str();
      if (std::find(into.begin(), into.end(), id) == into.end())
      {
        into.push_back(id);
      }
    }
  }
  else if (value.is_array() || value.is_object())
  {
    for (const auto& child : value)
    {
      findResourceRefs(child, into);
    }
  }
}

// One binding off the wire, or nothing when it is not one.
inline std::optional<ResourceBinding> readResourceBinding(const nlohmann::json& value,
                                                          const std::string& fallbackId = "")
{
  if (!value.is_object())
  {
    return std::nullopt;
  }
  const std::string id =
    (value.contains("id") && value["id"].is_string())
      ? value["id"].get<std::string>()
      : fallbackId;
  if (id.empty() || !isResourceId(id) ||
      !value.contains("kind") || !value["kind"].is_string())
  {
    return std::nullopt;
  }
  const std::string kind = value["kind"].get<std::string>();
  if (!isResourceKind(kind))
  {
    return std::nullopt;
  }

  std::string unreachable;
  if (value.contains("unreachable") && value["unreachable"].is_string())
  {
    unreachable = trimResourceField(value["unreachable"].get<std::string>());
  }

  ResourceBinding binding = {{"id", id}, {"kind", kind}};
  if (kind == "ollama" || kind == "postgres")
  {
    const std::string url =
      (value.contains("url") && value["url"].is_string())
        ? trimResourceField(value["url"].get<std::string>())
        : "";
    if (url.empty() && unreachable.empty())
    {
      return std::nullopt;
    }
    binding["url"] = url;
    if (kind == "postgres")
    {
      for (const char* field : {"user", "password", "database"})
      {
        if (value.contains(field) && value[field].is_string())
        {
          binding[field] = value[field];
        }
      }
    }
  }
  else if (kind == "s3")
  {
    const std::string endpoint =
      (value.contains("endpoint") && value["endpoint"].is_string())
        ? trimResourceField(value["endpoint"].get<std::string>())
        : "";
    if (endpoint.empty() && unreachable.empty())
    {
      return std::nullopt;
    }
    binding["endpoint"] = endpoint;
    for (const char* field : {"region", "bucket", "accessKey", "secretKey"})
    {
      if (value.contains(field) && value[field].is_string())
      {
        binding[field] = value[field];
      }
    }
  }

  if (!unreachable.empty())
  {
    binding["unreachable"] = unreachable;
  }
  return binding;
}

// Reads a resources payload off the wire: a map of id to binding, where null
// removes one, or a list of bindings.
inline std::map<std::string, nlohmann::json> readResourcesPayload(const nlohmann::json& value)
{
  std::map<std::string, nlohmann::json> entries;
  if (value.is_array())
  {
    for (const auto& item : value)
    {
      if (auto binding = readResourceBinding(item))
      {
        entries[(*binding)["id"].get<std::string>()] = *binding;
      }
    }
    return entries;
  }
  if (!value.is_object())
  {
    return entries;
  }
  for (const auto& [id, item] : value.items())
  {
    if (item.is_null())
    {
      if (isResourceId(id))
      {
        entries[id] = nullptr;
      }
      continue;
    }
    if (auto binding = readResourceBinding(item, id))
    {
      (*binding)["id"] = id;
      entries[id] = *binding;
    }
  }
  return entries;
}

class ResourceStore
{
public:
  // Replaces everything held.
  void replace(const std::map<std::string, nlohmann::json>& entries)
  {
    std::vector<std::string> changedIds;
    {
      std::lock_guard<std::recursive_mutex> lock(m_mutex);
      auto previous = std::move(m_bindings);
      m_bindings.clear();
      for (const auto& [id, entry] : entries)
      {
        if (!entry.is_null())
        {
          m_bindings[id] = entry;
        }
      }
      for (const auto& [id, prev] : previous)
      {
        auto it = m_bindings.find(id);
        if (it == m_bindings.end() || it->second != prev)
        {
          changedIds.push_back(id);
        }
      }
      for (const auto& [id, curr] : m_bindings)
      {
        if (previous.find(id) == previous.end())
        {
          changedIds.push_back(id);
        }
      }
    }
    for (const auto& id : changedIds)
    {
      changed(id);
    }
  }

  // Adds, replaces or removes (a null entry) individual bindings.
  void merge(const std::map<std::string, nlohmann::json>& entries)
  {
    for (const auto& [id, entry] : entries)
    {
      bool didChange = false;
      {
        std::lock_guard<std::recursive_mutex> lock(m_mutex);
        auto it = m_bindings.find(id);
        if (entry.is_null())
        {
          if (it != m_bindings.end())
          {
            m_bindings.erase(it);
            didChange = true;
          }
        }
        else
        {
          if (it == m_bindings.end() || it->second != entry)
          {
            m_bindings[id] = entry;
            didChange = true;
          }
        }
      }
      if (didChange)
      {
        changed(id);
      }
    }
  }

  std::vector<std::string> ids() const
  {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    std::vector<std::string> names;
    names.reserve(m_bindings.size());
    for (const auto& [id, _] : m_bindings)
    {
      names.push_back(id);
    }
    return names;
  }

  std::size_t subscribe(const std::string& id,
                        std::function<void(const std::string&)> listener)
  {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    const auto handle = m_nextListener++;
    m_listeners[handle] = {id, std::move(listener)};
    return handle;
  }

  void unsubscribe(std::size_t handle)
  {
    std::lock_guard<std::recursive_mutex> lock(m_mutex);
    m_listeners.erase(handle);
  }

  ResourceResolution resolve(const std::string& reference,
                             const std::string& expectedKind = "") const
  {
    const auto id = parseResourceRef(reference);
    if (!id)
    {
      return {std::nullopt, nlohmann::json(reference).dump() + " is not a resource reference"};
    }
    ResourceBinding binding;
    {
      std::lock_guard<std::recursive_mutex> lock(m_mutex);
      auto it = m_bindings.find(*id);
      if (it == m_bindings.end())
      {
        return {std::nullopt, "resource \"" + *id + "\" is not bound"};
      }
      binding = it->second;
    }
    const std::string kind =
      (binding.contains("kind") && binding["kind"].is_string())
        ? binding["kind"].get<std::string>()
        : "";
    if (!expectedKind.empty() && kind != expectedKind)
    {
      return {std::nullopt,
              "resource \"" + *id + "\" is of kind \"" + kind + "\", not \"" + expectedKind + "\""};
    }
    if (binding.contains("unreachable") && binding["unreachable"].is_string() &&
        !binding["unreachable"].get<std::string>().empty())
    {
      return {std::nullopt, binding["unreachable"].get<std::string>()};
    }
    binding.erase("unreachable");
    return {binding, ""};
  }

private:
  void changed(const std::string& id)
  {
    std::vector<std::function<void(const std::string&)>> listeners;
    {
      std::lock_guard<std::recursive_mutex> lock(m_mutex);
      for (const auto& [_, entry] : m_listeners)
      {
        if (entry.first == id)
        {
          listeners.push_back(entry.second);
        }
      }
    }
    for (const auto& listener : listeners)
    {
      try
      {
        listener(id);
      }
      catch (...)
      {
      }
    }
  }

  mutable std::recursive_mutex m_mutex;
  std::map<std::string, ResourceBinding> m_bindings;
  std::map<std::size_t, std::pair<std::string, std::function<void(const std::string&)>>> m_listeners;
  std::size_t m_nextListener = 1;
};

} // namespace hkp
