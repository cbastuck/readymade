#pragma once

#include <chrono>
#include <memory>
#include <string>

#include "auth.h"

namespace crow
{
  struct request;
  struct response;
}

namespace hkp
{
  class App;

  class Server
  {
  public:
    Server(std::shared_ptr<App> app,
           const std::string& name,
           const std::string& allowedOrigins,
           const std::string& displayName = "",
           AuthConfig authConfig = {});
    ~Server();
  
    void start(const std::string& externalIP, unsigned int port, const std::string& bindAddress = "0.0.0.0");
    void stop();
  
    unsigned int port() const;
    const std::string& externalIP() const;
    const std::string& name() const;
    const std::string& allowedOrigins() const;

    // Fans a serialized notification frame out to every WebSocket connection
    // bound to `runtimeId` (skipping write-only clients). Thread-safe.
    void sendNotification(const std::string& runtimeId, const std::string& frame);

    // Updates the runtime's allow-listed user emails at runtime (thread-safe).
    // Used by hosts that learn the permitted identity after start (e.g. iOS on
    // login). No-op unless the server was started in Jwt auth mode.
    void setAllowedUsers(const std::vector<std::string>& emails);

    // Mints a short-lived capability token scoped to POST /runtimes/<runtimeId>
    // (the process endpoint) for handing to an out-of-band device via a QR code.
    // Returns the raw token, or "" if the runtime is unknown/empty or secure
    // randomness is unavailable. Intended to be called in-process by the host's
    // own scheme handler (the owner's local app), so it is deliberately NOT
    // exposed as a network route — possession of the token alone can only
    // process that one runtime.
    std::string mintProcessRuntimeGrant(const std::string& runtimeId,
                                        std::chrono::seconds ttl = std::chrono::seconds{10 * 60});

    void handleRequest(crow::request& req, crow::response& res);

  private:
    struct impl;
    std::unique_ptr<impl> m_impl;
  };  
}
