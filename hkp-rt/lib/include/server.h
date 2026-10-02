#pragma once

#include <chrono>
#include <memory>
#include <string>

#include "auth.h"
#include "coordinator_links.h"
#include "mounts.h"

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
    // Send a JSON text frame to the connections bound to a runtime. Used for
    // messages a receiver dispatches on by `type` (a log entry), as opposed to
    // the binary YAS frames a notification takes.
    void sendText(const std::string& runtimeId, const std::string& text);

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

    // Lets this server be introduced to coordinators (POST /coordinator-links)
    // and reconnects with the tickets `store` kept from before. Until this is
    // called the server says it cannot join one, and refuses an introduction.
    //
    // The host supplies the store because only it knows where this server's
    // data lives; a host that should not hold a coordinator's runtimes — a
    // phone, which is suspended at will — does not call this.
    void enableCoordinatorLinks(std::shared_ptr<LinkStore> store,
                                CoordinatorLinksOptions options = {});

    /**
     * How this server gives its services a path on its own port; see mounts.h.
     */
    struct MountOptions
    {
      /** Keys the id derivation. A server given none draws one for this
       *  process: addresses that work but do not survive a restart. */
      std::string secret;
      /** Where this server is reached from outside, when that is not
       *  `http://<externalIP>:<port>` — behind a proxy terminating TLS, say. */
      std::string externalUrl;
      /** What it is reached at until `start` says: a service mounted while a
       *  board is loaded before the server starts publishes this. */
      std::string externalHost;
      unsigned int port = 0;
    };

    // Serves mounts on this server's own port. Must be called before `start`.
    //
    // With mounts, every connection arrives at a front door that hands a
    // mount's to the service owning it and passes the rest to the REST api,
    // which then listens on loopback only. Without, the api listens on the
    // port itself and a service that needs an endpoint binds one of its own.
    void enableMounts(MountOptions options);

    // Gives a service a path on this server's port and returns the address
    // clients are pointed at, or "" when this server serves no mounts. A
    // connection to that path is handed to `adopter`.
    std::string mount(const std::string& boardName, const std::string& runtimeId,
                      const std::string& name, const void* owner,
                      MountAdopter adopter);
    void unmount(const std::string& boardName, const std::string& runtimeId,
                 const std::string& name, const void* owner);

    void handleRequest(crow::request& req, crow::response& res);

  private:
    struct impl;
    std::unique_ptr<impl> m_impl;
  };  
}
