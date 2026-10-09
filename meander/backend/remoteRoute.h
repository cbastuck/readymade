#pragma once

#include <string>
#include <unordered_map>

/**
 * Which remote an `hkp://remotes/<name>/…` request is addressed to.
 *
 * Only this app's own runtime is reachable through that scheme; every other
 * remote is listed with its real URL (see SchemeHandler::handleGetRemotes), so a
 * name that is not ours names nothing and the request must be refused.
 *
 * This lives apart from SchemeHandler because the handler takes a
 * `saucer::scheme::request`, which is a pimpl the webview backend constructs —
 * it cannot be built in a test. Keeping the rule here keeps it testable; the
 * header deliberately depends on nothing but the standard library.
 */
namespace readymade
{

/** Route parameters as the Router produces them (`:remote` → its value). */
using RouteParams = std::unordered_map<std::string, std::string>;

/**
 * What every Readymade app calls the runtime it embeds, and lists it as.
 *
 * A board says `"remote": "embedded"` to mean the runtime of whichever app
 * opened it (`EMBEDDED_REMOTE_NAME` in hkp-frontend's runtime/board/remote.ts).
 * The name an app gave its runtime before this one — the server's own name,
 * `meander-cpp` here — is still answered to, for the boards that say it.
 */
inline const std::string kEmbeddedRemoteName = "embedded";

/** Whether `name` is one this app's own runtime goes by — and so not one a
 *  runtime server somebody keeps may take. */
inline bool isOwnRemoteName(const std::string& name, const std::string& serverName)
{
  return name == kEmbeddedRemoteName || name == serverName;
}

/**
 * Whether a forwarded request names this app's own runtime.
 *
 * False for an unknown name and for a missing parameter alike: both mean the
 * caller asked for a runtime this app cannot speak for. Answering anyway is
 * what this used to do — the name was captured by the route and then ignored,
 * so `hkp://remotes/anything` reached the embedded runtime, and a board pointed
 * at a runtime that was not running loaded and ran somewhere else with nothing
 * to show for it: no failed request, no port in use, no way to tell from the
 * app which runtime was answering.
 */
inline bool isOwnRemote(const RouteParams& params, const std::string& serverName)
{
  const auto remote = params.find("remote");
  if (remote == params.cend())
  {
    return false;
  }
  return isOwnRemoteName(remote->second, serverName);
}

/** The remote a request named, or empty when it named none. */
inline std::string requestedRemote(const RouteParams& params)
{
  const auto remote = params.find("remote");
  return remote == params.cend() ? std::string{} : remote->second;
}

}
