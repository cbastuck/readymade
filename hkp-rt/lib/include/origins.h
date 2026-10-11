#pragma once

#include <algorithm>
#include <cctype>
#include <string>
#include <vector>

namespace hkp
{

/**
 * Which browser pages may call a server, and when a request that carries no
 * credential is let in.
 *
 * Being reachable only from this machine is not the same as being called only
 * by this machine's owner: a page in their browser is a local caller too, and
 * any site can address `127.0.0.1`. So a request admitted by where it comes
 * from rather than by what it carries — a server running without auth, or a
 * loopback caller of one that has it — must also not come from a foreign page,
 * and must address the server by a name the server knows. A browser states
 * the first in `Origin` (or, on a request it sends without one, in
 * `Sec-Fetch-Site`) and the second in `Host`; a page cannot forge either.
 *
 * A caller that is not a browser sends none of these, and is let in as
 * before: another process on this machine is not what this guards against.
 */

namespace origins
{

inline std::string lower(std::string value)
{
  std::transform(value.begin(), value.end(), value.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return value;
}

inline std::string trim(const std::string& value)
{
  const auto first = value.find_first_not_of(" \t\r\n");
  if (first == std::string::npos)
  {
    return "";
  }
  const auto last = value.find_last_not_of(" \t\r\n");
  return value.substr(first, last - first + 1);
}

inline bool allDigits(const std::string& value)
{
  return !value.empty() &&
         std::all_of(value.begin(), value.end(), [](unsigned char c) { return std::isdigit(c) != 0; });
}

// Four dot-separated numbers and nothing else. Strict, because the names this
// is asked about come from a request: "127.0.0.1.example.com" is a name
// somebody else resolves, not an address.
inline bool isIPv4Literal(const std::string& host)
{
  int parts = 0;
  size_t start = 0;
  while (start <= host.size())
  {
    const auto dot = host.find('.', start);
    const auto part = host.substr(start, dot == std::string::npos ? std::string::npos : dot - start);
    if (!allDigits(part) || part.size() > 3 || std::stoi(part) > 255)
    {
      return false;
    }
    ++parts;
    if (dot == std::string::npos)
    {
      break;
    }
    start = dot + 1;
  }
  return parts == 4;
}

// "[…]" holding only what an IPv6 address is written with.
inline bool isIPv6Literal(const std::string& host)
{
  if (host.size() < 4 || host.front() != '[' || host.back() != ']')
  {
    return false;
  }
  const auto inner = host.substr(1, host.size() - 2);
  return inner.find(':') != std::string::npos &&
         std::all_of(inner.begin(), inner.end(), [](unsigned char c) {
           return std::isxdigit(c) != 0 || c == ':' || c == '.';
         });
}

/** Splits "host[:port]" — a `Host` header, or what follows an origin's scheme.
 *  False when it is neither. */
inline bool splitHostPort(const std::string& value, std::string& host, std::string& port)
{
  if (value.empty())
  {
    return false;
  }
  size_t hostEnd;
  if (value.front() == '[')
  {
    const auto close = value.find(']');
    if (close == std::string::npos)
    {
      return false;
    }
    hostEnd = close + 1;
  }
  else
  {
    hostEnd = value.find(':');
    if (hostEnd == std::string::npos)
    {
      hostEnd = value.size();
    }
  }
  host = lower(value.substr(0, hostEnd));
  port.clear();
  if (hostEnd == value.size())
  {
    return !host.empty();
  }
  if (value[hostEnd] != ':')
  {
    return false;
  }
  port = value.substr(hostEnd + 1);
  return !host.empty() && allDigits(port);
}

inline bool isLoopbackName(const std::string& host)
{
  return host == "localhost" || host == "[::1]" ||
         (isIPv4Literal(host) && host.rfind("127.", 0) == 0);
}

} // namespace origins

/** True for the origin of a page served from this machine, on any port. */
inline bool isLoopbackOrigin(const std::string& origin)
{
  const auto value = origins::lower(origin);
  size_t schemeLength = 0;
  if (value.rfind("http://", 0) == 0)
  {
    schemeLength = 7;
  }
  else if (value.rfind("https://", 0) == 0)
  {
    schemeLength = 8;
  }
  else
  {
    return false;
  }
  std::string host;
  std::string port;
  return origins::splitHostPort(value.substr(schemeLength), host, port) &&
         origins::isLoopbackName(host);
}

/**
 * True when a `Host` header names the server by something a page cannot have
 * arranged: an address, `localhost`, or a name the server was told is its own.
 *
 * A page that resolves its own name to this machine (DNS rebinding) is
 * same-origin with the server as far as the browser can tell, and sends no
 * `Origin` to refuse — but the name it used is still in `Host`. A request
 * without the header was not sent by a browser.
 */
inline bool isKnownHost(const std::string& hostHeader, const std::vector<std::string>& ownNames)
{
  const auto value = origins::trim(hostHeader);
  if (value.empty())
  {
    return true;
  }
  std::string host;
  std::string port;
  if (!origins::splitHostPort(value, host, port))
  {
    return false;
  }
  if (host == "localhost" || origins::isIPv4Literal(host) || origins::isIPv6Literal(host))
  {
    return true;
  }
  return std::any_of(ownNames.begin(), ownNames.end(), [&host](const std::string& name) {
    return !name.empty() && origins::lower(name) == host;
  });
}

/**
 * The origins a server was told may call it.
 *
 * Read from one value, the way `ALLOWED_ORIGINS` gives it:
 *
 * - nothing — the origins Readymade's own apps run from, and any page served
 *   from this machine;
 * - a comma-separated list — exactly those;
 * - `*` — any origin, for a request that carries a credential. A request that
 *   carries none is never let in on the strength of `*`: for it, `*` reads as
 *   nothing was said.
 *
 * A host may add origins of its own on top (`add`), e.g. the address it serves
 * the app from, or ones the person using it chose.
 */
class AllowedOrigins
{
public:
  AllowedOrigins() = default;

  static AllowedOrigins parse(const std::string& value)
  {
    AllowedOrigins result;
    const auto trimmed = origins::trim(value);
    if (trimmed.empty())
    {
      return result;
    }
    if (trimmed == "*")
    {
      result.m_any = true;
      return result;
    }
    result.m_listed = true;
    size_t start = 0;
    while (start <= trimmed.size())
    {
      const auto comma = trimmed.find(',', start);
      const auto entry = origins::trim(
        trimmed.substr(start, comma == std::string::npos ? std::string::npos : comma - start));
      if (!entry.empty())
      {
        result.m_list.push_back(origins::lower(entry));
      }
      if (comma == std::string::npos)
      {
        break;
      }
      start = comma + 1;
    }
    return result;
  }

  /** Replaces what a host added before with `added`. */
  void add(const std::vector<std::string>& added)
  {
    m_added.clear();
    for (const auto& origin : added)
    {
      const auto entry = origins::trim(origin);
      if (!entry.empty() && entry != "*")
      {
        m_added.push_back(origins::lower(entry));
      }
    }
  }

  /** Whether a page at `origin` may read what the server answers, and call it
   *  with a credential. */
  bool allows(const std::string& origin) const
  {
    return m_any || allowsWithoutCredential(origin);
  }

  /** Whether a page at `origin` may call the server with nothing but where it
   *  is calling from. */
  bool allowsWithoutCredential(const std::string& origin) const
  {
    const auto value = origins::lower(origins::trim(origin));
    if (value.empty())
    {
      return false;
    }
    if (std::find(m_added.begin(), m_added.end(), value) != m_added.end())
    {
      return true;
    }
    if (m_listed)
    {
      return std::find(m_list.begin(), m_list.end(), value) != m_list.end();
    }
    return isAppOrigin(value) || isLoopbackOrigin(value);
  }

private:
  // Where the Readymade apps load their pages from: the packaged desktop app,
  // the iOS app and the Android app.
  static bool isAppOrigin(const std::string& origin)
  {
    return origin == "saucer://embedded" || origin == "hkp://app" ||
           origin == "https://appassets.androidplatform.net";
  }

  bool m_any = false;
  bool m_listed = false;
  std::vector<std::string> m_list;
  std::vector<std::string> m_added;
};

/** What a request says about where it came from. */
struct RequestSource
{
  std::string origin;       // `Origin`
  std::string secFetchSite; // `Sec-Fetch-Site`
  std::string host;         // `Host`
};

/**
 * Whether a request that carries no credential may be let in on the strength
 * of where it comes from. See the top of this file.
 */
inline bool admitsWithoutCredential(const RequestSource& source,
                                    const AllowedOrigins& allowed,
                                    const std::vector<std::string>& ownNames)
{
  if (!origins::trim(source.origin).empty())
  {
    if (!allowed.allowsWithoutCredential(source.origin))
    {
      return false;
    }
  }
  // A browser leaves `Origin` off a plain GET it makes for another site's
  // page — an image, a script — and says so here instead.
  else if (origins::lower(origins::trim(source.secFetchSite)) == "cross-site")
  {
    return false;
  }
  return isKnownHost(source.host, ownNames);
}

} // namespace hkp
