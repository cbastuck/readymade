#include "server.h"

#include <algorithm>
#include <chrono>
#include <map>
#include <mutex>
#include <set>

#include <crow.h>
#include "origins.h"

#include <app.h>
#include <auth.h>
#include <types/validation.h>

#include "common/websocket_protocol.h"
#include "discovery/discovery.h"
#include "uuid.h"
#include "process_context.h"
#include "http/front_door.h"

#include <atomic>
#include <thread>

namespace hkp
{

// Which runtime server this is, reported beside the runtimes so a client can
// tell remote runtimes apart without reading their address.
constexpr const char* kRuntimeServerKind = "c++";

// Per-connection bookkeeping for a notification WebSocket, stored as the Crow
// connection's userdata. `runtimeId` is empty until the client sends its
// protocol handshake ({type, id}); after that the connection is registered
// against that runtime and forwards/receives its messages.
struct WsConnState
{
  std::string runtimeId;
  std::string type;  // "writer" | "reader" | "readwrite"
  // Whoever opened the socket, when a token said so; nobody for a socket let
  // in without one (no-auth mode, the local machine).
  Caller caller;
};

// Who a verified token speaks for, to a run they begin. The token's `sub` is
// the identity; hkp-rt only ever authorizes a verified, allow-listed email.
inline Caller callerOf(const std::optional<Principal>& principal)
{
  Caller caller;
  if (principal && !principal->sub.empty())
  {
    caller.sub = principal->sub;
    caller.email = principal->email;
  }
  return caller;
}

// Crow middleware that gates every route on the runtime's Authenticator.
// In no-auth mode (loopback bind) it is a pass-through. CORS preflight
// (OPTIONS) requests carry no Authorization header and must never be gated.
// Extracts the token from an "Authorization: Bearer <token>" header value.
// Returns empty when the header is missing or not a bearer credential.
inline std::string bearerToken(const std::string& header)
{
  constexpr const char* prefix = "Bearer ";
  constexpr size_t prefixLen = 7;
  if (header.size() <= prefixLen || header.compare(0, prefixLen, prefix) != 0)
  {
    return "";
  }
  return header.substr(prefixLen);
}

// Where a request came from. Behind the front door every request arrives from
// this process, which says who the caller was in a header — believed only
// beside the secret the front door alone knows. See http/front_door.h.
inline std::string callerAddress(const crow::request& req, const std::string& frontSecret)
{
  if (!frontSecret.empty() &&
      req.get_header_value(FrontDoor::FRONT_HEADER) == frontSecret)
  {
    return req.get_header_value(FrontDoor::CLIENT_HEADER);
  }
  return req.remote_ip_address;
}

// What the server knows about who may call it from a browser: the origins it
// was told, and the names it answers to. Shared by the middleware and the
// WebSocket accept, and changed while requests are being served.
struct OriginGate
{
  AllowedOrigins allowed() const
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_allowed;
  }

  void setAllowed(AllowedOrigins allowed)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_allowed = std::move(allowed);
  }

  void add(const std::vector<std::string>& origins)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_allowed.add(origins);
  }

  void addOwnName(const std::string& name)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_ownNames.push_back(name);
  }

  // Whether a request carrying no credential may be let in; see origins.h.
  bool admits(const crow::request& req) const
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return admitsWithoutCredential(
      RequestSource{req.get_header_value("Origin"),
                    req.get_header_value("Sec-Fetch-Site"),
                    req.get_header_value("Host")},
      m_allowed, m_ownNames);
  }

private:
  mutable std::mutex m_mutex;
  AllowedOrigins m_allowed;
  std::vector<std::string> m_ownNames;
};

struct AuthMiddleware
{
  struct context
  {
    // Set when a bearer token was verified for this request. Left empty for
    // every request let in some other way — no-auth mode, the local machine, a
    // scoped capability grant — which is a request with nobody to name.
    std::optional<Principal> principal;
  };

  // Set once mounts are enabled; see callerAddress.
  std::string frontSecret;

  Authenticator* authenticator = nullptr;
  CapabilityStore* capabilities = nullptr;
  OriginGate* origins = nullptr;

  void before_handle(crow::request& req, crow::response& res, context& ctx)
  {
    if (!authenticator)
    {
      return;
    }
    if (req.method == crow::HTTPMethod::Options)
    {
      return;
    }
    // WebSocket upgrades are authenticated in the WS onaccept handler instead:
    // a browser cannot set an Authorization header on a handshake, so the token
    // rides in ?access_token=. Gating here would 401 every notification socket.
    if (req.upgrade)
    {
      return;
    }
    const bool noAuth = authenticator->isNoAuth();
    // The local machine is trusted, even when the runtime is bound to 0.0.0.0
    // for LAN access: the loopback interface cannot be reached from off-host.
    // This lets the owner drive (and start discovery on) their own runtime
    // without having to add themselves to the allow-list; only genuine LAN
    // peers are challenged for a token.
    //
    // A page in the owner's browser is on this machine too, though, and so is
    // every site it has open. Being local therefore lets a request in only
    // when it does not come from a foreign page; see origins.h.
    if (noAuth || isLoopbackHost(callerAddress(req, frontSecret)))
    {
      if (!origins || origins->admits(req))
      {
        return;
      }
      if (noAuth)
      {
        // Nothing else could let it in. Answered without CORS headers (see
        // CorsMiddleware), so the page that sent it can read neither this nor
        // that anything answered: what a server that is not there looks like.
        res.code = 403;
        res.end();
        return;
      }
      // With auth configured, a request refused as a local one may still
      // carry a credential, and is asked for it like any other.
    }
    // Scoped capability tokens are checked before JWT, exactly like an opaque
    // token — but bound to a single method+path. For example, a phone that
    // scanned a freshly minted QR can POST to its one upload runtime and nothing
    // else; a token presented for any other route (or to mint more tokens) fails
    // the scope match here and falls through to the JWT path, which denies it.
    if (capabilities &&
        capabilities->authorize(bearerToken(req.get_header_value("Authorization")),
                                 crow::method_name(req.method), req.url))
    {
      return;
    }
    const auto result = authenticator->authorize(req.get_header_value("Authorization"));
    if (result.status == AuthStatus::Ok)
    {
      ctx.principal = result.principal;
      return;
    }
    res.code = (result.status == AuthStatus::Forbidden) ? 403 : 401;
    res.end();
  }

  void after_handle(crow::request&, crow::response&, context&) {}
};

// Says which page may read an answer and send a request that has to be asked
// for first: the page that is asking, when it is one this server allows.
//
// One place states it for every response — a handler's, an error's — so that
// none can answer a page the server does not allow.
//
// A preflight is the exception. Crow answers one as soon as it has read the
// request line, before the headers that say which page is asking, so it is
// answered the same for every page: yes, the request may be sent. That gives a
// foreign page nothing — the request it then sends states its origin and is
// refused on it, exactly as one that needs no preflight is.
struct CorsMiddleware
{
  struct context {};

  OriginGate* origins = nullptr;
  Authenticator* authenticator = nullptr;

  void before_handle(crow::request&, crow::response&, context&) {}

  void after_handle(crow::request& req, crow::response& res, context&)
  {
    if (req.method == crow::HTTPMethod::Options)
    {
      res.set_header("Access-Control-Allow-Origin", "*");
      allowRequest(res);
      return;
    }
    const auto origin = req.get_header_value("Origin");
    if (origin.empty() || !origins)
    {
      return;
    }
    // A server without auth takes no credentials, so `*` — any page, with
    // one — allows nobody there.
    const auto allowed = origins->allowed();
    const bool noAuth = !authenticator || authenticator->isNoAuth();
    if (noAuth ? !allowed.allowsWithoutCredential(origin) : !allowed.allows(origin))
    {
      return;
    }
    res.set_header("Access-Control-Allow-Origin", origin);
    res.add_header("Vary", "Origin");
    allowRequest(res);
  }

  static void allowRequest(crow::response& res)
  {
    res.set_header("Access-Control-Allow-Methods", "*");
    res.set_header("Access-Control-Allow-Headers",
                   "Content-Type, Authorization, Content-Disposition, "
                   "X-Upload-Id, X-Chunk-Index, X-Total-Chunks");
  }
};

using CrowApp = crow::Crow<CorsMiddleware, AuthMiddleware>;

struct JsonResponse : crow::response
{
  explicit JsonResponse(const json &_body)
      : crow::response{_body.dump()}
  {
    add_header("Access-Control-Allow-Headers",
               "Content-Type, Authorization, Content-Disposition, "
               "X-Upload-Id, X-Chunk-Index, X-Total-Chunks");
    add_header("Content-Type", "application/json");
  }
};
struct Server::impl
{
  impl(std::shared_ptr<App> a, const std::string& n, const std::string& ao = "*",
       const std::string& dn = "", AuthConfig ac = {})
    : app(a)
    , name(n)
    , allowedOrigins(ao)
    , displayName(dn)
    , authenticator(std::make_unique<Authenticator>(std::move(ac)))
  {
    originGate.setAllowed(AllowedOrigins::parse(allowedOrigins));
    setupRoutes();
  }

  // Friendly name shown to peers during discovery. Platforms that have a better
  // name than the hostname (e.g. iOS, UIDevice.name) pass it in; otherwise fall
  // back to the machine hostname.
  std::string discoveryName() const
  {
    return displayName.empty() ? discoveryDeviceName() : displayName;
  }

  void setupRoutes()
  {
    auto& cors = crow.get_middleware<CorsMiddleware>();
    cors.origins = &originGate;
    cors.authenticator = authenticator.get();

    auto& authMiddleware = crow.get_middleware<AuthMiddleware>();
    authMiddleware.authenticator = authenticator.get();
    authMiddleware.capabilities = &capabilities;
    authMiddleware.origins = &originGate;

    CROW_ROUTE(crow, "/runtimes")
        .methods("GET"_method)([this]() { return getRuntimes(); }); 
  
    CROW_ROUTE(crow, "/runtimes")
        .methods("DELETE"_method)([this](const crow::request &req) { return deleteAllRuntimes(); });
  
    CROW_ROUTE(crow, "/runtimes")
        .methods("POST"_method)([this](const crow::request &req) -> crow::response { return createRuntimes(req); }); 
  
    CROW_ROUTE(crow, "/runtimes/<string>")
        .methods("GET"_method)([this](const crow::request &req, std::string id) { return getRuntimeById(id); }); 
  
    CROW_ROUTE(crow, "/runtimes/<string>")
        .methods("DELETE"_method)([this](const crow::request &req, std::string id) { return deleteRuntime(id); });

    // Values for the references this runtime's services hold.
    //
    // Provisioning carries them already; this is for the moments it cannot
    // cover — a board being built a service at a time, an entry edited while a
    // board is running, and a re-push after a restart where the services
    // survived but the vault did not. It merges, so a client sending one entry
    // does not strip the rest.
    //
    // POST rather than PUT: it merges rather than replaces, and every other
    // mutation this server takes is a POST — a lone PUT is a method each
    // runtime implementation would have to remember to allow through CORS.
    //
    // There is deliberately no GET. The values go one way: in, and then only to
    // a service resolving a reference for a call it is making. What is held can
    // be *named* — the response says which aliases the runtime now has —
    // because a client needs to show whether a credential is configured.
    CROW_ROUTE(crow, "/runtimes/<string>/secrets")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return setSecrets(req, runtimeId); });

    // Descriptors for the assets this runtime's services reference. Provisioning
    // carries them already; this is for a configuration naming one the runtime
    // was not given, for an asset edited while the board runs — which is how an
    // edit reaches a service without reconfiguring it — and for a re-push after
    // a restart. It merges, and null removes an asset. Answers with ids, never
    // content.
    CROW_ROUTE(crow, "/runtimes/<string>/assets")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return setAssets(req, runtimeId); });

    // Whether an asset resolves here, and to what: a check, not a download.
    CROW_ROUTE(crow, "/runtimes/<string>/assets/<string>")
        .methods("GET"_method)([this](const crow::request &, std::string runtimeId, std::string assetId) -> crow::response {
          auto checked = app->checkRuntimeAsset(runtimeId, assetId);
          if (checked.is_null())
          {
            return crow::response{crow::status::NOT_FOUND};
          }
          return makeJsonResponse(checked);
        });

    // Change what a running runtime records, without rebuilding it. Separate
    // from POST /runtimes/<id>, which processes data rather than configuring
    // anything.
    CROW_ROUTE(crow, "/runtimes/<string>/state")
        .methods("PATCH"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return setRuntimeState(req, runtimeId); });

    CROW_ROUTE(crow, "/runtimes/<string>/rearrange")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return rearrangeServices(req, runtimeId); });

    CROW_ROUTE(crow, "/runtimes/<string>")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return processRuntime(req, runtimeId); });

    // A person's own client introducing this server to a coordinator, for one
    // runtime of one board: it has asked the coordinator for a ticket and
    // passes it on. This server then connects to the coordinator — the
    // coordinator connects to nothing — and keeps the ticket to reconnect with.
    CROW_ROUTE(crow, "/coordinator-links")
        .methods("POST"_method)([this](const crow::request &req) -> crow::response { return introduceCoordinator(req); });

    // The links held: which runtimes belong to which board, never a ticket.
    CROW_ROUTE(crow, "/coordinator-links")
        .methods("GET"_method)([this]() -> crow::response {
          return makeJsonResponse(json{{"links", coordinatorLinks ? coordinatorLinks->list() : json::array()}});
        });

    // Leaves a board: drops the link and the runtime it was for.
    CROW_ROUTE(crow, "/coordinator-links/<string>/<string>")
        .methods("DELETE"_method)([this](const crow::request &req, std::string boardName, std::string runtimeId) -> crow::response {
          const bool removed = coordinatorLinks && coordinatorLinks->remove(boardName, runtimeId);
          return crow::response{removed ? crow::status::OK : crow::status::NOT_FOUND};
        });

    CROW_ROUTE(crow, "/runtimes/<string>/inputs")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return getRuntimeInputs(req, runtimeId); });

    CROW_ROUTE(crow, "/runtimes/<string>/inputs/<string>")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId, std::string inputId) -> crow::response { return getRuntimeInput(req, runtimeId, inputId); });

    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return configureService(req, runtimeId, instanceId); }); 

    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>/process")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return processService(req, runtimeId, instanceId); });

    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return getServiceState(runtimeId, instanceId); }); 

    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>/property/<string>")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId, std::string propertyId) -> crow::response { return getServiceStateProperty(runtimeId, instanceId, propertyId); }); 
  
    CROW_ROUTE(crow, "/runtimes/<string>/services")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return getServices(req, runtimeId); });

    // TODO this should be a PUT and the POST should replace all services
    CROW_ROUTE(crow, "/runtimes/<string>/services")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return createService(req, runtimeId); });
  
    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>")
        .methods("DELETE"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return deleteService(runtimeId, instanceId); });

    // ── LAN discovery ──
    CROW_ROUTE(crow, "/discover")
        .methods("POST"_method)([this](const crow::request &req) { return startDiscover(req); });

    CROW_ROUTE(crow, "/discover")
        .methods("GET"_method)([this]() { return getDiscover(); });

    CROW_ROUTE(crow, "/discover")
        .methods("DELETE"_method)([this]() { return stopDiscover(); });

    CROW_ROUTE(crow, "/identity")
        .methods("GET"_method)([this]() { return getIdentity(); });

    // ── Notification WebSocket ──
    // One socket for every runtime in this process; connections bind to a
    // runtime via their protocol handshake. Authenticated in onaccept (the HTTP
    // AuthMiddleware deliberately skips upgrades).
    CROW_WEBSOCKET_ROUTE(crow, "/notifications")
        .onaccept([this](const crow::request& req, void** userdata) { return wsOnAccept(req, userdata); })
        .onmessage([this](crow::websocket::connection& conn, const std::string& message, bool isBinary) { wsOnMessage(conn, message, isBinary); })
        .onclose([this](crow::websocket::connection& conn, const std::string& /*reason*/, uint16_t /*code*/) { wsOnClose(conn); });
    }

  crow::response getRuntimes();
  crow::response deleteRuntime(const std::string& runtimeId);
  crow::response deleteAllRuntimes();
  crow::response createRuntimes(const crow::request &req);
  crow::response configureService(const crow::request &req, const std::string& runtimeId,  const std::string& instanceId);
  crow::response getServiceState(const std::string& runtimeId, const std::string& instanceId);
  crow::response getServiceStateProperty(const std::string& runtimeId, const std::string& instanceId, const std::string& propertyId);
  crow::response getServices(const crow::request &req, const std::string& runtimeId);
  crow::response createService(const crow::request &req, const std::string& runtimeId);
  crow::response deleteService(const std::string& runtimeId, const std::string& instanceId);
  crow::response getRuntimeById(const std::string& id);
  crow::response rearrangeServices(const crow::request &req, const std::string& runtimeId);
  crow::response setSecrets(const crow::request &req, const std::string& runtimeId);
  crow::response setAssets(const crow::request &req, const std::string& runtimeId);
  crow::response setRuntimeState(const crow::request &req, const std::string& runtimeId);
  crow::response introduceCoordinator(const crow::request &req);
  crow::response processRuntime(const crow::request &req, const std::string& runtimeId);
  // Who a request is from, when a token said so; see AuthMiddleware::context.
  Caller callerOfRequest(const crow::request& req);
  crow::response processService(const crow::request &req, const std::string& runtimeId, const std::string& instanceId);
  crow::response getRuntimeInputs(const crow::request &req, const std::string& runtimeId);
  crow::response getRuntimeInput(const crow::request &req, const std::string& runtimeId, const std::string& inputId);

  // ── Notification WebSocket ──────────────────────────────────────────────────
  bool wsOnAccept(const crow::request& req, void** userdata);
  void wsOnMessage(crow::websocket::connection& conn, const std::string& message, bool isBinary);
  void wsOnClose(crow::websocket::connection& conn);
  void reapIfAbandoned(const std::string& runtimeId);
  void sendNotification(const std::string& runtimeId, const std::string& frame);
  void sendText(const std::string& runtimeId, const std::string& text);

  JsonResponse makeJsonResponse(const json &_body)
  {
    return JsonResponse(_body);
  }

  // ── LAN discovery ──────────────────────────────────────────────────────────
  // Advertising is only meaningful when the runtime is LAN-reachable (bound to
  // 0.0.0.0); a localhost-only instance can still browse for peers.
  json discoverState()
  {
    auto peers = json::array();
    for (const auto& peer : discovery.peers())
    {
      peers.push_back(peer);
    }
    return json{
        {"active", discovery.isActive()},
        {"endsAt", discovery.endsAtEpochMs()},
        {"peers", peers},
    };
  }

  crow::response startDiscover(const crow::request& req)
  {
    int seconds = 30;
    if (!req.body.empty())
    {
      try
      {
        auto body = json::parse(req.body);
        if (body.contains("durationSeconds") && body["durationSeconds"].is_number_integer())
        {
          seconds = body["durationSeconds"].get<int>();
        }
      }
      catch (...) { /* fall back to default */ }
    }
    seconds = std::clamp(seconds, 5, 120);

    DiscoveryManager::Identity self;
    self.id = instanceId;
    self.name = discoveryName();
    self.port = crow.port();
    discovery.start(self, /*advertise=*/bindAddress == "0.0.0.0", seconds);
    return makeJsonResponse(discoverState());
  }

  crow::response getDiscover()
  {
    return makeJsonResponse(discoverState());
  }

  crow::response stopDiscover()
  {
    discovery.stop();
    return makeJsonResponse(discoverState());
  }

  crow::response getIdentity()
  {
    return makeJsonResponse(json{
        {"id", instanceId},
        {"name", discoveryName()},
        {"platform", discoveryPlatformName()},
        {"port", crow.port()},
        {"exposed", bindAddress == "0.0.0.0"},
    });
  }

  CrowApp crow;
  std::string externalIP;
  std::shared_ptr<App> app;
  std::string name;
  std::string allowedOrigins;
  OriginGate originGate;
  std::string displayName;
  std::string bindAddress;
  std::string instanceId = generateUUID();
  std::unique_ptr<Authenticator> authenticator;
  // Set by a host that serves mounts; see Server::enableMounts.
  std::unique_ptr<FrontDoor> frontDoor;
  Server::MountOptions mountOptions;
  std::atomic<unsigned int> publicPort{0};
  // Set by a host that lets this server be introduced to coordinators.
  std::unique_ptr<CoordinatorLinks> coordinatorLinks;
  CapabilityStore capabilities;
  DiscoveryManager discovery;

  // runtimeId → live notification connections. Guarded by wsMutex because it is
  // touched from Crow's IO thread (accept/message/close) and the App event-loop
  // thread (sendNotification).
  std::mutex wsMutex;
  std::map<std::string, std::set<crow::websocket::connection*>> wsByRuntime;
};

Server::Server(
  std::shared_ptr<App> app,
  const std::string& name,
  const std::string& allowedOrigins,
  const std::string& displayName,
  AuthConfig authConfig
) : m_impl(std::make_unique<impl>(app, name, allowedOrigins, displayName, std::move(authConfig)))
{
  app->setServer(this);
}

Server::~Server()
{
  m_impl->app->setServer(nullptr);
}

void Server::handleRequest(crow::request& req, crow::response& res)
{
  m_impl->crow.handle_full(req, res);
}

void Server::start(const std::string& externalIP, unsigned int port, const std::string& bindAddress)
{
  m_impl->externalIP = externalIP;
  // A name this server is reached by, when it was given one rather than an
  // address; see isKnownHost.
  m_impl->originGate.addOwnName(externalIP);
  m_impl->bindAddress = bindAddress;
  if (!m_impl->frontDoor)
  {
    m_impl->crow.bindaddr(bindAddress).port(port).run();
    return;
  }

  // The front door takes the port. The api listens on loopback, on a port the
  // OS picks and nobody is told, and is reached through the front door only.
  m_impl->publicPort = port;
  std::atomic<bool> failed{false};
  auto* impl = m_impl.get();
  std::thread opener([impl, &failed, bindAddress, port]() {
    impl->crow.wait_for_server_start(std::chrono::milliseconds(30000));
    const auto bound = impl->frontDoor->start(
      bindAddress, static_cast<unsigned short>(port), impl->crow.port());
    if (bound == 0)
    {
      failed = true;
      impl->crow.stop();
      return;
    }
    impl->publicPort = bound;
  });
  m_impl->crow.bindaddr("127.0.0.1").port(0).run();
  opener.join();
  m_impl->frontDoor->stop();
  if (failed)
  {
    throw std::runtime_error("could not listen on " + bindAddress + ":" + std::to_string(port));
  }
}

void Server::enableMounts(MountOptions options)
{
  if (options.secret.empty())
  {
    options.secret = generateUUID() + generateUUID();
  }
  m_impl->mountOptions = std::move(options);
  m_impl->originGate.addOwnName(m_impl->mountOptions.externalHost);
  m_impl->publicPort = m_impl->mountOptions.port;
  if (m_impl->externalIP.empty())
  {
    m_impl->externalIP = m_impl->mountOptions.externalHost;
  }
  // Known to this process only: what makes the caller's address, as the front
  // door passes it on, something the api can believe.
  m_impl->frontDoor = std::make_unique<FrontDoor>(generateUUID() + generateUUID());
  m_impl->crow.get_middleware<AuthMiddleware>().frontSecret = m_impl->frontDoor->frontSecret();
}

MountHandle Server::mount(const std::string& boardName, const std::string& runtimeId,
                          const std::string& name, MountAdopter adopter,
                          bool deployed)
{
  if (!m_impl->frontDoor)
  {
    return {};
  }
  const auto id = deriveMountId(m_impl->mountOptions.secret, "", boardName, runtimeId, name);
  auto release = m_impl->frontDoor->mount(id, std::move(adopter), deployed);
  const std::string base = !m_impl->mountOptions.externalUrl.empty()
    ? m_impl->mountOptions.externalUrl
    : "http://" + m_impl->externalIP + ":" + std::to_string(port());
  return MountHandle(name, base + MOUNT_PREFIX + "/" + id, std::move(release));
}

void Server::enableCoordinatorLinks(std::shared_ptr<LinkStore> store,
                                    CoordinatorLinksOptions options)
{
  m_impl->coordinatorLinks = std::make_unique<CoordinatorLinks>(
    m_impl->app, std::move(store), std::move(options));
  m_impl->coordinatorLinks->restore();
}

void Server::stop() 
{
  // Before the routes go: a link's connection is closed, its ticket kept.
  if (m_impl->coordinatorLinks)
  {
    m_impl->coordinatorLinks->stop();
  }
  m_impl->crow.stop();
}

unsigned int Server::port() const
{
  // The port callers use, which with mounts is the front door's.
  return m_impl->frontDoor ? m_impl->publicPort.load() : m_impl->crow.port();
}

const std::string& Server::externalIP() const
{
  return m_impl->externalIP;
}

const std::string& Server::name() const
{
  return m_impl->name;
}

const std::string& Server::allowedOrigins() const
{
  return m_impl->allowedOrigins;
}

void Server::allowOrigins(const std::vector<std::string>& origins)
{
  m_impl->originGate.add(origins);
}

crow::response Server::impl::getRuntimes()
{
  auto arr = json::array();
  for (auto& rt : app->getRuntimes())
  {
    arr.push_back(jsonSerialise(rt));
  }
  return makeJsonResponse(json{{"runtimes", arr}, {"registry", app->getRegistry()}, {"server", kRuntimeServerKind}, {"coordinatorLinks", coordinatorLinks != nullptr}, {"boardRuntimes", true}});
}


crow::response Server::impl::deleteRuntime(const std::string& runtimeId)
{
  // Idempotent: a runtime already gone is the desired end state, not an error.
  // A client removing a runtime closes its notification socket first, and that
  // close reaps a garbage-collected runtime on its own — so by the time this
  // explicit DELETE arrives the runtime is frequently already removed. Returning
  // NOT_FOUND there surfaces a spurious "Failed to remove runtime" to the user.
  app->removeRuntime(runtimeId);
  return makeJsonResponse(json{{"id", runtimeId}});
}

crow::response Server::impl::deleteAllRuntimes()
{
  app->removeAllRuntimes();
  return crow::response{crow::status::OK};
}

crow::response Server::impl::createRuntimes(const crow::request &req)
{
  if (req.body.empty())
  {
    return crow::response(crow::status::BAD_REQUEST); // same as crow::response(400)
  }

  auto arr = json::array();
  auto body = json::parse(req.body);
  if (!body.is_array() && !body.is_object())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  auto runtimeBody = body.is_array() ? body : json::array({body});
  for (auto it : runtimeBody)
  {
    auto rtConfig = validateRuntime(it);
    if (!rtConfig) 
    {
      return crow::response(crow::status::BAD_REQUEST); 
    }
    auto createdConfig = app->createRuntime(*rtConfig);
    arr.push_back(jsonSerialise(createdConfig));
  }
  return makeJsonResponse({json{{"runtimes", arr}, {"registry", app->getRegistry()}, {"server", kRuntimeServerKind}, {"coordinatorLinks", coordinatorLinks != nullptr}, {"boardRuntimes", true}}});
}

crow::response Server::impl::configureService(const crow::request &req, const std::string& runtimeId, const std::string& instanceId)
{
  if (req.body.empty())
  {
    return crow::response(crow::status::BAD_REQUEST); // same as crow::response(400)
  }

  auto body = json::parse(req.body);
  if (!body.is_object())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  const auto context = ProcessContext::forClient(json(), callerOfRequest(req));
  auto config = app->configureService(runtimeId, instanceId, body, "", &context);
  if (config.is_null())
  {
    return crow::response(crow::status::NOT_FOUND);
  }

  return makeJsonResponse({config});
}

crow::response Server::impl::getServiceState(const std::string& runtimeId, const std::string& instanceId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  auto state = app->getServiceState(runtimeId, instanceId);
  if (state.is_null())
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return makeJsonResponse({state});
}

crow::response Server::impl::getServiceStateProperty(const std::string& runtimeId, const std::string& instanceId, const std::string& propertyId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  auto state = app->getServiceState(runtimeId, instanceId);
  if (state.is_null())
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  auto property = state[propertyId];
  if (property.is_null())
  {
    std::cout << "Propety not found in: " << state << std::endl;
    return crow::response{crow::status::NOT_FOUND};
  }
  return makeJsonResponse(property);
}

crow::response Server::impl::getServices(const crow::request &req, const std::string& runtimeId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  auto services = app->getServices(runtimeId);
  return makeJsonResponse(services);
}

crow::response Server::impl::createService(const crow::request &req, const std::string& runtimeId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }

  if (req.body.empty())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto arr = json::array();
  auto body = json::parse(req.body);
  if (body.is_null())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  
  auto serviceConfig = validateService(body);
  if (!serviceConfig)
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto res = app->appendService(runtimeId, *serviceConfig);
  if (res.is_null())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  return makeJsonResponse(res);
}

crow::response Server::impl::deleteService(const std::string& runtimeId, const std::string& instanceId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }

  auto res = app->removeService(runtimeId, instanceId);
  return makeJsonResponse(res);
}

crow::response Server::impl::getRuntimeById(const std::string& id)
{
  auto rt = app->getRuntime(id);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return makeJsonResponse(jsonSerialise(*rt));
}

crow::response Server::impl::introduceCoordinator(const crow::request &req)
{
  if (!coordinatorLinks)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  const json body = json::parse(req.body, nullptr, /*allow_exceptions=*/false);
  const auto text = [&body](const char* key) {
    return body.is_object() && body.contains(key) && body[key].is_string()
      ? body[key].get<std::string>() : std::string();
  };
  const LinkRecord record{text("boardName"), text("runtimeId"),
                          text("coordinatorUrl"), text("ticket")};
  if (record.boardName.empty() || record.runtimeId.empty() ||
      record.coordinatorUrl.empty() || record.ticket.empty())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  // The values for the references that runtime's services carry. Handed to the
  // runtime when the coordinator builds it, and not sent to the coordinator.
  const auto reason = coordinatorLinks->introduce(
    record, readSecretsPayload(body.contains("secrets") ? body["secrets"] : json()));
  if (!reason.empty())
  {
    auto refused = makeJsonResponse(json{{"error", reason}});
    refused.code = 502;
    return refused;
  }
  auto connected = makeJsonResponse(json{{"connected", true}});
  connected.code = 201;
  return connected;
}

crow::response Server::impl::setRuntimeState(const crow::request &req, const std::string& runtimeId)
{
  json body;
  try
  {
    body = json::parse(req.body);
  }
  catch (const std::exception&)
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  if (!body.is_object())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  auto settings = app->setRuntimeState(runtimeId, body);
  if (settings.is_null())
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return makeJsonResponse(settings);
}

crow::response Server::impl::setSecrets(const crow::request &req, const std::string& runtimeId)
{
  json body;
  try
  {
    body = json::parse(req.body);
  }
  catch (const std::exception&)
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  if (!body.is_object())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto held = app->setRuntimeSecrets(runtimeId, readSecretsPayload(body));
  if (held.is_null())
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return makeJsonResponse(held);
}

crow::response Server::impl::setAssets(const crow::request &req, const std::string& runtimeId)
{
  json body;
  try
  {
    body = json::parse(req.body);
  }
  catch (const std::exception&)
  {
    return crow::response(crow::status::BAD_REQUEST);
  }
  if (!body.is_object() && !body.is_array())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto held = app->setRuntimeAssets(runtimeId, readAssetsPayload(body));
  if (held.is_null())
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return makeJsonResponse(held);
}

crow::response Server::impl::rearrangeServices(const crow::request &req, const std::string& runtimeId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  
  auto body = json::parse(req.body);
  if (!body.is_array())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto serviceOrdering = validateServiceOrdering(body);
  if (!serviceOrdering)
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto res = app->rearrangeServices(runtimeId, *serviceOrdering);
  if (res.is_null())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  return makeJsonResponse(res);
}

// Builds the Data variant a request body means, by its content type. Shared
// by the runtime-wide process route and the per-service one, so an upload
// reaches a service the same way whichever entry point it arrives through.
static std::optional<Data> buildInputData(const crow::request& req,
                                          const std::string& contentType)
{

    if (contentType == "application/json")
    {
      try
      {
        auto body = json::parse(req.body);
        // `null` is a payload: it says run with nothing on the input, which is
        // how a caller writes "no input" in a format that has no undefined.
        // Undefined is what the first service is handed, the same as over the
        // socket. A body that is absent entirely is still refused, above.
        if (body.is_null())
          return Data();
        if (!body.is_object())
          return std::nullopt;
        return Data(std::move(body));
      }
      catch (...) { return std::nullopt; }
    }

    if (contentType.rfind("text/plain", 0) == 0)
      return Data(req.body);

    if (contentType.rfind("multipart/form-data", 0) == 0)
    {
      auto msg = crow::multipart::message(req);
      if (msg.parts.empty())
        return std::nullopt;

      // Use the first part as the binary payload; collect its headers as meta.
      auto& firstPart = msg.parts[0];
      BinaryData binary(firstPart.body.begin(), firstPart.body.end());

      json meta = json::object();
      for (auto& [headerName, header] : firstPart.headers)
      {
        json headerMeta;
        headerMeta["value"] = header.value;
        for (auto& [paramName, paramValue] : header.params)
          headerMeta["params"][paramName] = paramValue;
        meta[headerName] = std::move(headerMeta);
      }

      return Data(MixedData{std::move(meta), std::move(binary)});
    }

    // Raw binary fallback: image/*, application/octet-stream, etc.
    // Promote to MixedData when a filename is present in Content-Disposition so
    // that downstream services (e.g. filesystem) can use the original filename.
    {
      BinaryData binary(req.body.begin(), req.body.end());
      auto contentDisposition = req.get_header_value("Content-Disposition");
      std::string filename;
      if (!contentDisposition.empty())
      {
        auto pos = contentDisposition.find("filename=");
        if (pos != std::string::npos)
        {
          filename = contentDisposition.substr(pos + 9);
          // Strip surrounding quotes if present
          if (filename.size() >= 2 && filename.front() == '"')
            filename = filename.substr(1, filename.size() - 2);
        }
      }
      if (!filename.empty())
      {
        json meta = json::object();
        meta["path"] = filename;
        auto uploadId      = req.get_header_value("X-Upload-Id");
        auto chunkIndexStr = req.get_header_value("X-Chunk-Index");
        auto totalChunksStr= req.get_header_value("X-Total-Chunks");
        if (!uploadId.empty()) meta["uploadId"] = uploadId;
        if (!chunkIndexStr.empty())
        {
          try { meta["chunkIndex"] = std::stoi(chunkIndexStr); } catch (...) {}
        }
        if (!totalChunksStr.empty())
        {
          try { meta["totalChunks"] = std::stoi(totalChunksStr); } catch (...) {}
        }
        return Data(MixedData{std::move(meta), std::move(binary)});
      }
      return Data(std::move(binary));
    }
}

Caller Server::impl::callerOfRequest(const crow::request& req)
{
  // A request a host hands over in-process (Server::handleRequest) never
  // passed the middleware, so there is no context to read — and nobody to
  // name: it comes from the host's own page, not from a token.
  if (!req.middleware_context)
  {
    return {};
  }
  return callerOf(crow.get_context<AuthMiddleware>(req).principal);
}

crow::response Server::impl::processRuntime(const crow::request &req, const std::string& runtimeId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }

  if (req.body.empty())
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  auto contentType = req.get_header_value("Content-Type");

  auto inputData = buildInputData(req, contentType);
  if (!inputData)
  {
    std::cerr << "processRuntime: cannot parse body with Content-Type: " << contentType << '\n';
    return crow::response(crow::status::BAD_REQUEST);
  }

  try
  {
    // An external HTTP caller is not continuing a run, it is starting one —
    // as whoever its token says it is.
    auto result = app->processRuntimeAs(
      runtimeId, std::move(*inputData), ProcessContext::forClient(json(), callerOfRequest(req)));

    if (auto j = getJSONFromData(result))
      return makeJsonResponse(*j);

    if (auto b = getBinaryFromData(result))
    {
      crow::response res(200);
      res.body = std::string(b->begin(), b->end());
      res.set_header("Content-Type", "application/octet-stream");
      return res;
    }

    if (auto s = getStringFromData(result))
    {
      crow::response res(200);
      res.body = *s;
      res.set_header("Content-Type", "text/plain");
      return res;
    }

    return crow::response(crow::status::OK);
  }
  catch(const std::exception& e)
  {
    std::cerr << "processRuntime error: " << e.what() << '\n';
    return crow::response(crow::status::INTERNAL_SERVER_ERROR);
  }
}

// Runs the pipeline starting at one service, with a given payload.
//
// Distinct from configuring it: configure says what a service *is*, this says
// do your job with this. A facade button had only the former, so anything it
// needed to cause had to be smuggled in as a config field a service read as a
// command.
crow::response Server::impl::processService(const crow::request &req, const std::string& runtimeId, const std::string& instanceId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }

  auto contentType = req.get_header_value("Content-Type");
  // An empty body is a service being told to act on nothing, which is a
  // reasonable thing to ask of one that takes no input.
  auto inputData = req.body.empty() ? std::optional<Data>(json::object())
                                    : buildInputData(req, contentType);
  if (!inputData)
  {
    return crow::response(crow::status::BAD_REQUEST);
  }

  try
  {
    // The run is the one the body names, or a new one. The caller is never
    // the body's to name: it is whoever the token was verified as.
    json wire;
    if (const auto asJson = getJSONFromData(*inputData); asJson && asJson->is_object())
    {
      if (const auto it = asJson->find("__context"); it != asJson->end())
      {
        wire = *it;
      }
    }
    auto result = app->processServiceAtAs(
      runtimeId, instanceId, std::move(*inputData),
      ProcessContext::forClient(wire, callerOfRequest(req)));

    if (auto j = getJSONFromData(result))
      return makeJsonResponse(*j);

    if (auto b = getBinaryFromData(result))
    {
      crow::response res(200);
      res.body = std::string(b->begin(), b->end());
      res.set_header("Content-Type", "application/octet-stream");
      return res;
    }

    if (auto s = getStringFromData(result))
    {
      crow::response res(200);
      res.body = *s;
      res.set_header("Content-Type", "text/plain");
      return res;
    }

    return crow::response(crow::status::OK);
  }
  catch (const std::exception& e)
  {
    // The runtime holds no service by that id; anything else it throws is a
    // service failing, which is not the caller's mistake.
    std::cerr << "processService error: " << e.what() << '\n';
    return crow::response(crow::status::NOT_FOUND);
  }
}

crow::response Server::impl::getRuntimeInputs(const crow::request &req, const std::string& runtimeId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }

  auto arr = json::array();
  for (auto& input : rt->inputs)
  {
    arr.push_back(jsonSerialise(input));
  }
  return makeJsonResponse(arr);
}

crow::response Server::impl::getRuntimeInput(const crow::request &req, const std::string& runtimeId, const std::string& inputId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  for (auto& input : rt->inputs)
  {
    if (input.id == inputId)
    {
      return makeJsonResponse(jsonSerialise(input));
    }
  }
  return crow::response{crow::status::NOT_FOUND};
}

bool Server::impl::wsOnAccept(const crow::request& req, void** userdata)
{
  // Same policy as the REST AuthMiddleware: no-auth mode and loopback clients
  // are allowed unless a foreign page is asking (a browser always states the
  // page's origin on a handshake); otherwise the token (carried in
  // ?access_token= because a browser can't set headers on a handshake) must
  // verify and be allow-listed.
  const bool local = authenticator->isNoAuth() ||
    isLoopbackHost(callerAddress(req, frontDoor ? frontDoor->frontSecret() : std::string()));
  bool allowed = local && originGate.admits(req);
  // Whoever a token names; nobody for a socket let in without one.
  Caller caller;
  if (!allowed)
  {
    if (const char* token = req.url_params.get("access_token"))
    {
      const auto result = authenticator->authorize(std::string("Bearer ") + token);
      allowed = result.status == AuthStatus::Ok;
      if (allowed)
      {
        caller = callerOf(result.principal);
      }
    }
  }
  if (!allowed)
  {
    return false;  // reject the upgrade
  }
  auto* state = new WsConnState();
  state->caller = caller;
  *userdata = state;
  return true;
}

void Server::impl::wsOnMessage(crow::websocket::connection& conn, const std::string& message, bool isBinary)
{
  auto* state = static_cast<WsConnState*>(conn.userdata());
  if (!state)
  {
    return;
  }

  // The first frame is the protocol handshake ({type, id}); it binds this
  // connection to a runtime. Everything after it is runtime traffic.
  if (state->runtimeId.empty())
  {
    try
    {
      auto protocol = WebsocketProtocol::parse(message);
      state->runtimeId = protocol.id;
      state->type = protocol.type;
      std::lock_guard<std::mutex> lock(wsMutex);
      wsByRuntime[state->runtimeId].insert(&conn);
    }
    catch (const std::exception& e)
    {
      std::cerr << "Server WS: invalid protocol handshake: " << e.what() << std::endl;
    }
    return;
  }

  app->dispatchRuntimeWsMessage(state->runtimeId, message, isBinary, &state->caller);
}

void Server::impl::wsOnClose(crow::websocket::connection& conn)
{
  auto* state = static_cast<WsConnState*>(conn.userdata());
  if (!state)
  {
    return;
  }
  bool abandoned = false;
  {
    std::lock_guard<std::mutex> lock(wsMutex);
    auto it = wsByRuntime.find(state->runtimeId);
    if (it != wsByRuntime.end())
    {
      it->second.erase(&conn);
      if (it->second.empty())
      {
        wsByRuntime.erase(it);
        abandoned = true;
      }
    }
  }

  if (abandoned)
  {
    reapIfAbandoned(state->runtimeId);
  }

  delete state;
  conn.userdata(nullptr);
}

/**
 * Tears down a runtime whose creator asked for cleanup, now that its last
 * client has disconnected.
 *
 * Whoever created it said whether it should outlive its clients. A browser
 * running a board is that board's controller and asks for cleanup: closing the
 * tab should not leave runtimes behind. A coordinator, a config file or a
 * script says nothing, and their runtimes stay until deleted — a headless
 * runtime is not an abandoned one, and a runtime is never reaped because of who
 * happened to connect to it.
 */
void Server::impl::reapIfAbandoned(const std::string& runtimeId)
{
  // getConfiguration carries the declaration back, so the public API is enough
  // to answer this — no need to reach for the Runtime itself.
  auto config = app->getRuntime(runtimeId);
  if (!config || !config->garbageCollected)
  {
    return;
  }
  std::cout << "Server: releasing runtime \"" << runtimeId
            << "\" — its last client disconnected and it asked to be cleaned up"
            << std::endl;
  app->removeRuntime(runtimeId);
}

void Server::impl::sendText(const std::string& runtimeId, const std::string& text)
{
  // A text frame rather than the binary one notifications take: what travels
  // here is a JSON message whose `type` the receiver dispatches on, not a YAS
  // frame carrying a Data.
  std::lock_guard<std::mutex> lock(wsMutex);
  auto it = wsByRuntime.find(runtimeId);
  if (it == wsByRuntime.end())
  {
    return;
  }
  for (auto* conn : it->second)
  {
    auto* state = static_cast<WsConnState*>(conn->userdata());
    if (state && state->type == "writer")
    {
      continue;  // write-only clients don't receive anything back
    }
    conn->send_text(text);
  }
}

void Server::impl::sendNotification(const std::string& runtimeId, const std::string& frame)
{
  std::lock_guard<std::mutex> lock(wsMutex);
  auto it = wsByRuntime.find(runtimeId);
  if (it == wsByRuntime.end())
  {
    return;
  }
  for (auto* conn : it->second)
  {
    auto* state = static_cast<WsConnState*>(conn->userdata());
    if (state && state->type == "writer")
    {
      continue;  // write-only clients don't receive notifications
    }
    conn->send_binary(frame);
  }
}

void Server::sendNotification(const std::string& runtimeId, const std::string& frame)
{
  m_impl->sendNotification(runtimeId, frame);
}

void Server::sendText(const std::string& runtimeId, const std::string& text)
{
  m_impl->sendText(runtimeId, text);
}

void Server::setAllowedUsers(const std::vector<std::string>& emails)
{
  m_impl->authenticator->setAllowedEmails(emails);
}

std::string Server::mintProcessRuntimeGrant(const std::string& runtimeId, std::chrono::seconds ttl)
{
  // Only mint for a runtime that actually exists in this process, so a token can
  // never be scoped to a phantom endpoint.
  if (runtimeId.empty() || !m_impl->app->getRuntime(runtimeId))
  {
    std::cerr << "[auth] refusing to mint process-runtime grant for unknown or empty runtime '"
              << runtimeId << "'" << std::endl;
    return "";
  }
  return m_impl->capabilities.mintProcessRuntimeGrant(runtimeId, ttl);
}

}
