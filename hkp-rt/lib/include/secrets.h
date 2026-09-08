#pragma once

#include <algorithm>
#include <map>
#include <optional>
#include <regex>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace hkp {

// Secrets a runtime was given, and the one way to a value.
//
// A board carries `{{secret.<alias>}}` references and never a value. The values
// arrive separately — with the runtime's create payload, or on
// POST /runtimes/<id>/secrets — and are held here, apart from every service's
// state. Nothing reads them back out: there is no route that returns one, they
// are not in a serialized runtime, and a service obtains one only through
// resolve(), for one use, at the moment of that use.
//
// That is what keeps a board safe to save. A service holds a reference, reports
// a reference from getState(), and the board it is serialized into never holds
// anything else.
//
// The format matches hkp-frontend/src/core/secrets.ts and hkp-node/src/secrets.ts
// exactly: a board written against one runtime has to open against another.

struct SecretEntry
{
  std::string value;
  // Hosts this secret may be sent to. Empty means unconstrained — which is what
  // an entry carrying no audience answers.
  std::vector<std::string> audience;
};

struct SecretRefusal
{
  std::string alias;
  std::string to;
  std::vector<std::string> audience;
};

// `{{secret.alias}}`, tolerating whitespace inside the braces. Dots are part of
// an alias rather than separators: `secret.` is a fixed prefix and `}}`
// terminates, so `{{secret.gmail.imap}}` has exactly one reading.
inline const std::regex& secretReferencePattern()
{
  static const std::regex pattern(R"(\{\{\s*secret\.([A-Za-z0-9_.\-]+)\s*\}\})");
  return pattern;
}

// The host part of a destination.
//
// Callers hold destinations in whatever shape their own API uses — a request
// URL, a `host:port` pair, a bare hostname — and normalizing here is what keeps
// an audience a list of hosts rather than a list of spellings. Anything that
// does not yield a host answers empty.
inline std::string destinationHost(const std::string& to)
{
  auto trimmed = to;
  const auto notSpace = [](unsigned char c) { return !std::isspace(c); };
  trimmed.erase(trimmed.begin(),
                std::find_if(trimmed.begin(), trimmed.end(), notSpace));
  trimmed.erase(std::find_if(trimmed.rbegin(), trimmed.rend(), notSpace).base(),
                trimmed.end());
  if (trimmed.empty())
  {
    return "";
  }

  const auto scheme = trimmed.find("://");
  auto rest = scheme == std::string::npos ? trimmed : trimmed.substr(scheme + 3);
  // Anything after the authority, and any credentials before it, are not the
  // host; a port is part of the address but not of the name being matched.
  const auto at = rest.find('@');
  if (at != std::string::npos)
  {
    rest = rest.substr(at + 1);
  }
  rest = rest.substr(0, rest.find_first_of("/?#"));
  rest = rest.substr(0, rest.find(':'));
  std::transform(rest.begin(), rest.end(), rest.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  return rest;
}

// Whether an audience covers a host.
//
// An entry is either a host or a `*.` prefix standing for any subdomain of what
// follows it. The wildcard does not match the bare domain: `*.example.com`
// covers `api.example.com` and not `example.com`, so widening one to the other
// stays a deliberate act.
inline bool audiencePermits(const std::vector<std::string>& audience,
                            const std::string& host)
{
  if (audience.empty())
  {
    return true;
  }
  for (auto allowed : audience)
  {
    std::transform(allowed.begin(), allowed.end(), allowed.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    if (allowed.empty())
    {
      continue;
    }
    if (allowed.rfind("*.", 0) == 0)
    {
      const auto suffix = allowed.substr(1);
      if (host.size() > suffix.size() &&
          host.compare(host.size() - suffix.size(), suffix.size(), suffix) == 0)
      {
        return true;
      }
      continue;
    }
    if (host == allowed)
    {
      return true;
    }
  }
  return false;
}

// Every alias a value refers to, however deeply it is nested.
inline std::vector<std::string> referencedSecrets(const nlohmann::json& value)
{
  std::vector<std::string> found;
  const std::function<void(const nlohmann::json&)> walk =
      [&](const nlohmann::json& node)
  {
    if (node.is_string())
    {
      const auto text = node.get<std::string>();
      for (auto it = std::sregex_iterator(text.begin(), text.end(),
                                          secretReferencePattern());
           it != std::sregex_iterator(); ++it)
      {
        const auto alias = (*it)[1].str();
        if (std::find(found.begin(), found.end(), alias) == found.end())
        {
          found.push_back(alias);
        }
      }
      return;
    }
    if (node.is_array() || node.is_object())
    {
      for (const auto& child : node)
      {
        walk(child);
      }
    }
  };
  walk(value);
  return found;
}

struct ResolvedSecrets
{
  nlohmann::json value;
  std::vector<std::string> missing;
  std::vector<SecretRefusal> refused;
};

class SecretVault
{
public:
  // Replaces everything held.
  void replace(const std::map<std::string, SecretEntry>& entries)
  {
    m_entries = entries;
  }

  // Adds or replaces individual entries, leaving the rest alone.
  void merge(const std::map<std::string, SecretEntry>& entries)
  {
    for (const auto& [alias, entry] : entries)
    {
      m_entries[alias] = entry;
    }
  }

  // The aliases held, for saying whether something is configured. Deliberately
  // the only thing this answers about its contents.
  std::vector<std::string> aliases() const
  {
    std::vector<std::string> names;
    names.reserve(m_entries.size());
    for (const auto& [alias, _] : m_entries)
    {
      names.push_back(alias);
    }
    return names;
  }

  // A value with its references resolved, for one use.
  //
  // The result is transient: what a service passes to the call it is making,
  // never something to assign back to its state. `to` is required and a caller
  // that cannot name a destination gets nothing — every caller can, because a
  // secret is used by sending it somewhere.
  //
  // An alias that is not held, or that may not go to this destination, becomes
  // an empty string and is reported by name. Empty is what "not configured"
  // already looks like to the code that takes a credential; the literal
  // reference would be sent as one and fail far away, naming nothing.
  ResolvedSecrets resolve(const nlohmann::json& value,
                          const std::string& to) const
  {
    ResolvedSecrets out;
    const auto host = destinationHost(to);
    if (host.empty())
    {
      // No destination is not the same as no audience: without one there is
      // nothing to check a secret against, so nothing is released.
      out.value = value;
      out.missing = referencedSecrets(value);
      return out;
    }

    const std::function<nlohmann::json(const nlohmann::json&)> walk =
        [&](const nlohmann::json& node) -> nlohmann::json
    {
      if (node.is_string())
      {
        return substitute(node.get<std::string>(), host, out);
      }
      if (node.is_array())
      {
        nlohmann::json copy = nlohmann::json::array();
        for (const auto& child : node)
        {
          copy.push_back(walk(child));
        }
        return copy;
      }
      if (node.is_object())
      {
        nlohmann::json copy = nlohmann::json::object();
        for (const auto& [key, child] : node.items())
        {
          copy[key] = walk(child);
        }
        return copy;
      }
      return node;
    };

    out.value = walk(value);
    return out;
  }

private:
  std::string substitute(const std::string& text, const std::string& host,
                         ResolvedSecrets& out) const
  {
    std::string result;
    auto begin = std::sregex_iterator(text.begin(), text.end(),
                                      secretReferencePattern());
    const auto end = std::sregex_iterator();
    std::size_t last = 0;
    for (auto it = begin; it != end; ++it)
    {
      const auto match = *it;
      result.append(text, last, static_cast<std::size_t>(match.position()) - last);
      last = static_cast<std::size_t>(match.position() + match.length());

      const auto alias = match[1].str();
      const auto found = m_entries.find(alias);
      if (found == m_entries.end())
      {
        note(out.missing, alias);
        continue;
      }
      if (!audiencePermits(found->second.audience, host))
      {
        if (std::none_of(out.refused.begin(), out.refused.end(),
                         [&](const SecretRefusal& r) { return r.alias == alias; }))
        {
          out.refused.push_back({alias, host, found->second.audience});
        }
        continue;
      }
      result.append(found->second.value);
    }
    result.append(text, last, text.size() - last);
    return result;
  }

  static void note(std::vector<std::string>& names, const std::string& name)
  {
    if (std::find(names.begin(), names.end(), name) == names.end())
    {
      names.push_back(name);
    }
  }

  std::map<std::string, SecretEntry> m_entries;
};

// One credential, resolved for one use, or the reason there is none.
//
// What a service holds is either a reference or a literal, and either may be
// absent; the caller wants a value it can send or a sentence it can report.
// Separating those two outcomes here keeps every service that takes a
// credential from writing the same four branches.
//
// A literal is returned as it stands, which is what a runtime configured from a
// file holds. A reference needs a vault, and without one it resolves to nothing
// rather than being sent as its own text — a caller handed `{{secret.…}}` would
// offer it as a credential and fail somewhere far away.
//
// Takes a whole structure as readily as one string, because a credential is not
// always a field of its own: it can be one entry in a map of headers, or part
// of a larger string around it. On any failure it resolves nothing, rather than
// handing back a half-filled structure a caller might send anyway.
struct ResolvedCredential
{
  nlohmann::json value;
  std::string problem;
};

inline ResolvedCredential resolveCredential(const SecretVault* vault,
                                            const nlohmann::json& held,
                                            const std::string& to)
{
  const auto references = referencedSecrets(held);
  if (references.empty())
  {
    return {held, ""};
  }

  const auto names = [&references]()
  {
    std::string joined;
    for (const auto& name : references)
    {
      joined += joined.empty() ? name : ", " + name;
    }
    return joined;
  };

  if (vault == nullptr)
  {
    return {nullptr, "no secrets available to resolve " + names()};
  }

  const auto resolved = vault->resolve(held, to);
  if (!resolved.refused.empty())
  {
    const auto& refusal = resolved.refused.front();
    return {nullptr, refusal.alias + " may not be sent to " + refusal.to};
  }
  if (!resolved.missing.empty())
  {
    std::string joined;
    for (const auto& name : resolved.missing)
    {
      joined += joined.empty() ? name : ", " + name;
    }
    return {nullptr, "no value stored for " + joined};
  }
  return {resolved.value, ""};
}

// Reads a secrets payload off the wire.
//
// Tolerant of the short form — a bare string is a value with no audience —
// because that is what a client with nothing to say about destinations sends.
// Anything it cannot read is dropped rather than failing the request: a
// malformed entry costs one credential, and the service referencing it will
// report it as unavailable by name.
inline std::map<std::string, SecretEntry>
readSecretsPayload(const nlohmann::json& value)
{
  std::map<std::string, SecretEntry> entries;
  if (!value.is_object())
  {
    return entries;
  }
  for (const auto& [alias, entry] : value.items())
  {
    if (entry.is_string())
    {
      entries[alias] = SecretEntry{entry.get<std::string>(), {}};
      continue;
    }
    if (!entry.is_object() || !entry.contains("value") ||
        !entry["value"].is_string())
    {
      continue;
    }
    SecretEntry read;
    read.value = entry["value"].get<std::string>();
    if (entry.contains("audience") && entry["audience"].is_array())
    {
      for (const auto& host : entry["audience"])
      {
        if (host.is_string())
        {
          read.audience.push_back(host.get<std::string>());
        }
      }
    }
    entries[alias] = read;
  }
  return entries;
}

} // namespace hkp
