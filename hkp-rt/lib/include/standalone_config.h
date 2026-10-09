#pragma once

#include <cstdlib>
#include <exception>
#include <functional>
#include <string>
#include <vector>

#include "auth.h"

namespace hkp
{

/**
 * What a standalone hkp-rt is started with, read from its arguments and its
 * environment.
 *
 * On a person's own machine none of it needs saying: it binds loopback, which
 * keeps other machines out, and answers no page but the Readymade apps' and
 * this machine's own (origins.h). Anywhere else — a container, a
 * server — the bind is opened with `HOST`, and that is only allowed together
 * with who may use it: a non-loopback bind without `AUTH0_DOMAIN`,
 * `AUTH0_AUDIENCE` and `ALLOWED_EMAILS` is refused rather than served open.
 *
 * The names are hkp-node's, so one environment file describes either server.
 */
struct StandaloneConfig
{
  unsigned int port = 5556;
  /** The interface listened on. `HOST`. */
  std::string bind = "127.0.0.1";
  /** The address this server tells others it is reached at. `EXTERNAL_HOST`. */
  std::string externalHost = "127.0.0.1";
  /** Where it is reached from outside, when that is not `http://<externalHost>:<port>`
   *  — behind a proxy that terminates TLS, say. `HKP_EXTERNAL_URL`. */
  std::string externalUrl;
  /** Origins allowed to call it from a browser; empty means the Readymade
   *  apps and pages served from this machine (see origins.h). `ALLOWED_ORIGINS`. */
  std::string allowedOrigins;
  AuthConfig auth;
  /** Where coordinator tickets are kept; empty keeps them in memory.
   *  `HKP_COORDINATOR_LINKS_FILE`. */
  std::string linksFile;
  /** Keys the addresses of this server's mounts. `HKP_MOUNT_SECRET`. */
  std::string mountSecret;
  /** Where that secret is kept when the environment gives none. */
  std::string mountSecretFile;
  /** A runtime config to load at start; the third argument. */
  std::string runtimeConfigFile;
  /** Set when the configuration must not be served; says what is missing. */
  std::string error;
};

using EnvironmentReader = std::function<const char*(const char*)>;

inline std::vector<std::string> splitList(const std::string& value)
{
  std::vector<std::string> items;
  std::string current;
  const auto flush = [&]() {
    const auto first = current.find_first_not_of(" \t\r\n");
    if (first != std::string::npos)
    {
      const auto last = current.find_last_not_of(" \t\r\n");
      items.push_back(current.substr(first, last - first + 1));
    }
    current.clear();
  };
  for (const char c : value)
  {
    if (c == ',')
    {
      flush();
    }
    else
    {
      current.push_back(c);
    }
  }
  flush();
  return items;
}

/**
 * Arguments are `<port> <externalHost> <runtime config>`, each optional, as
 * they always were; the environment says the rest and is overridden by an
 * argument where both name the same thing.
 */
inline StandaloneConfig readStandaloneConfig(
  const std::vector<std::string>& arguments,
  const EnvironmentReader& env = [](const char* name) { return std::getenv(name); })
{
  StandaloneConfig config;
  const auto read = [&env](const char* name) {
    const char* value = env(name);
    return value ? std::string(value) : std::string();
  };

  if (const auto port = read("PORT"); !port.empty())
  {
    try { config.port = static_cast<unsigned int>(std::stoul(port)); }
    catch (const std::exception&) { config.error = "PORT is not a number: " + port; }
  }
  if (const auto host = read("HOST"); !host.empty())
  {
    config.bind = host;
  }
  if (const auto external = read("EXTERNAL_HOST"); !external.empty())
  {
    config.externalHost = external;
  }
  config.externalUrl = read("HKP_EXTERNAL_URL");
  while (!config.externalUrl.empty() && config.externalUrl.back() == '/')
  {
    config.externalUrl.pop_back();
  }

  if (arguments.size() > 0)
  {
    try { config.port = static_cast<unsigned int>(std::stoul(arguments[0])); }
    catch (const std::exception&) { config.error = "The port is not a number: " + arguments[0]; }
  }
  if (arguments.size() > 1)
  {
    config.externalHost = arguments[1];
  }
  if (arguments.size() > 2)
  {
    config.runtimeConfigFile = arguments[2];
  }

  // Unset means the default beside this server's other data; set to the empty
  // string means keep them in memory only.
  const char* linksFile = env("HKP_COORDINATOR_LINKS_FILE");
  if (linksFile)
  {
    config.linksFile = linksFile;
  }
  else if (const auto home = read("HOME"); !home.empty())
  {
    config.linksFile = home + "/.hkp/cpp/coordinator-links.json";
  }

  config.mountSecret = read("HKP_MOUNT_SECRET");
  if (const auto home = read("HOME"); !home.empty())
  {
    config.mountSecretFile = home + "/.hkp/cpp/mount-secret";
  }

  const auto domain = read("AUTH0_DOMAIN");
  const auto audiences = splitList(read("AUTH0_AUDIENCE"));
  const auto emails = splitList(read("ALLOWED_EMAILS"));
  const bool exposed = !isLoopbackHost(config.bind);

  if (!domain.empty() && !audiences.empty())
  {
    TrustedIssuer issuer;
    // Auth0 issues `iss` as the tenant's address with a trailing slash.
    issuer.iss = (domain.rfind("https://", 0) == 0 ? domain : "https://" + domain);
    if (issuer.iss.back() != '/')
    {
      issuer.iss.push_back('/');
    }
    issuer.audiences = audiences;
    config.auth.mode = AuthMode::Jwt;
    config.auth.issuers.push_back(std::move(issuer));
    config.auth.allowedEmails = emails;
  }

  if (exposed)
  {
    std::string missing;
    const auto need = [&missing](bool present, const char* name) {
      if (!present)
      {
        missing += missing.empty() ? name : std::string(", ") + name;
      }
    };
    need(!domain.empty(), "AUTH0_DOMAIN");
    need(!audiences.empty(), "AUTH0_AUDIENCE");
    need(!emails.empty(), "ALLOWED_EMAILS");
    if (!missing.empty() && config.error.empty())
    {
      config.error =
        "Refusing to listen on " + config.bind + " without saying who may use this "
        "server: " + missing + " not set. Set them, or leave HOST unset to listen "
        "on 127.0.0.1 only.";
    }
  }
  if (const auto origins = read("ALLOWED_ORIGINS"); !origins.empty())
  {
    config.allowedOrigins = origins;
  }

  return config;
}

}
