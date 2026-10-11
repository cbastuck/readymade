#pragma once

#include <algorithm>
#include <cctype>
#include <string>
#include <vector>

/**
 * The sites a person lets call this app's runtime from a browser.
 *
 * The runtime answers the app itself and pages served from this machine
 * without being told (see hkp-rt's origins.h). Any other page — the playground
 * on the public website, a frontend somebody hosts — is a foreign one until it
 * is named here, in `allowedOrigins` of ~/.hkp/settings.json.
 *
 * What is kept is an origin, the way a browser states one: scheme, host and
 * port, nothing after. A person pastes an address, so that is what this turns
 * into one.
 */
namespace readymade
{

/** The origin of an address as a person wrote it, or "" when it has none.
 *  `https://Example.com/playground` → `https://example.com`. */
inline std::string normalizeOrigin(const std::string& value)
{
  const auto first = value.find_first_not_of(" \t\r\n");
  if (first == std::string::npos)
  {
    return "";
  }
  const auto last = value.find_last_not_of(" \t\r\n");
  std::string origin = value.substr(first, last - first + 1);
  std::transform(origin.begin(), origin.end(), origin.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

  const auto scheme = origin.find("://");
  if (scheme == std::string::npos || scheme == 0)
  {
    return "";
  }
  const auto authority = scheme + 3;
  const auto end = origin.find_first_of("/?#", authority);
  if (end != std::string::npos)
  {
    origin.erase(end);
  }
  // "Everybody" is not something to allow from here, and neither is an
  // address with nothing after its scheme.
  if (origin.size() == authority || origin.find('*') != std::string::npos ||
      origin.find_first_of(" \t,") != std::string::npos)
  {
    return "";
  }
  return origin;
}

/** `values` as origins: each normalized, the ones that are none dropped, and
 *  each kept once, in the order given. */
inline std::vector<std::string> normalizeOrigins(const std::vector<std::string>& values)
{
  std::vector<std::string> origins;
  for (const auto& value : values)
  {
    const auto origin = normalizeOrigin(value);
    if (!origin.empty() && std::find(origins.begin(), origins.end(), origin) == origins.end())
    {
      origins.push_back(origin);
    }
  }
  return origins;
}

} // namespace readymade
