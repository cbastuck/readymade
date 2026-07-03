#pragma once

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

    void handleRequest(crow::request& req, crow::response& res);

  private:
    struct impl;
    std::unique_ptr<impl> m_impl;
  };  
}
