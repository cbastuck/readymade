#include "server.h"

#include <algorithm>
#include <map>
#include <mutex>
#include <set>

#include <crow.h>
#include <crow/middlewares/cors.h>

#include <app.h>
#include <auth.h>
#include <types/validation.h>

#include "common/websocket_protocol.h"
#include "discovery/discovery.h"
#include "uuid.h"

namespace hkp
{

// Per-connection bookkeeping for a notification WebSocket, stored as the Crow
// connection's userdata. `runtimeId` is empty until the client sends its
// protocol handshake ({type, id}); after that the connection is registered
// against that runtime and forwards/receives its messages.
struct WsConnState
{
  std::string runtimeId;
  std::string type;  // "writer" | "reader" | "readwrite"
};

// Crow middleware that gates every route on the runtime's Authenticator.
// In no-auth mode (loopback bind) it is a pass-through. CORS preflight
// (OPTIONS) requests carry no Authorization header and must never be gated.
struct AuthMiddleware
{
  struct context {};

  Authenticator* authenticator = nullptr;
  std::string allowedOrigins = "*";

  void before_handle(crow::request& req, crow::response& res, context&)
  {
    if (!authenticator || authenticator->isNoAuth())
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
    // The local machine is always trusted, even when the runtime is bound to
    // 0.0.0.0 for LAN access: the loopback interface cannot be reached from
    // off-host, so a loopback-source request is necessarily this machine's own
    // UI. This lets the owner drive (and start discovery on) their own runtime
    // without having to add themselves to the allow-list; only genuine LAN peers
    // are challenged for a token.
    if (isLoopbackHost(req.remote_ip_address))
    {
      return;
    }
    const auto result = authenticator->authorize(req.get_header_value("Authorization"));
    if (result.status == AuthStatus::Ok)
    {
      return;
    }
    res.code = (result.status == AuthStatus::Forbidden) ? 403 : 401;
    res.add_header("Access-Control-Allow-Origin", allowedOrigins);
    res.end();
  }

  void after_handle(crow::request&, crow::response&, context&) {}
};

using CrowApp = crow::Crow<crow::CORSHandler, AuthMiddleware>;

struct JsonResponse : crow::response
{
  JsonResponse(const json &_body, const std::string allowedOrigins)
      : crow::response{_body.dump()}
  {
    add_header("Access-Control-Allow-Origin", allowedOrigins);
    add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
    setupRoutes(allowedOrigins);
  }

  // Friendly name shown to peers during discovery. Platforms that have a better
  // name than the hostname (e.g. iOS, UIDevice.name) pass it in; otherwise fall
  // back to the machine hostname.
  std::string discoveryName() const
  {
    return displayName.empty() ? discoveryDeviceName() : displayName;
  }

  void setupRoutes(const std::string& allowedOrigins)
  {
    auto& cors = crow.get_middleware<crow::CORSHandler>();
    cors.global().origin(allowedOrigins).headers("Content-Type", "Authorization");

    auto& authMiddleware = crow.get_middleware<AuthMiddleware>();
    authMiddleware.authenticator = authenticator.get();
    authMiddleware.allowedOrigins = allowedOrigins;

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

    CROW_ROUTE(crow, "/runtimes/<string>/rearrange")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return rearrangeServices(req, runtimeId); });

    CROW_ROUTE(crow, "/runtimes/<string>")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return processRuntime(req, runtimeId); });

    CROW_ROUTE(crow, "/runtimes/<string>/inputs")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return getRuntimeInputs(req, runtimeId); });

    CROW_ROUTE(crow, "/runtimes/<string>/inputs/<string>")
        .methods("GET"_method)([this](const crow::request &req, std::string runtimeId, std::string inputId) -> crow::response { return getRuntimeInput(req, runtimeId, inputId); });

    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return configureService(req, runtimeId, instanceId); }); 

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
  crow::response processRuntime(const crow::request &req, const std::string& runtimeId);
  crow::response getRuntimeInputs(const crow::request &req, const std::string& runtimeId);
  crow::response getRuntimeInput(const crow::request &req, const std::string& runtimeId, const std::string& inputId);

  // ── Notification WebSocket ──────────────────────────────────────────────────
  bool wsOnAccept(const crow::request& req, void** userdata);
  void wsOnMessage(crow::websocket::connection& conn, const std::string& message, bool isBinary);
  void wsOnClose(crow::websocket::connection& conn);
  void sendNotification(const std::string& runtimeId, const std::string& frame);

  JsonResponse makeJsonResponse(const json &_body)
  {
    return JsonResponse(_body, allowedOrigins);
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
  std::string displayName;
  std::string bindAddress;
  std::string instanceId = generateUUID();
  std::unique_ptr<Authenticator> authenticator;
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
  m_impl->bindAddress = bindAddress;
  m_impl->crow.bindaddr(bindAddress).port(port).run();
}

void Server::stop() 
{
  m_impl->crow.stop();
}

unsigned int Server::port() const
{
  return m_impl->crow.port();
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

crow::response Server::impl::getRuntimes()
{
  auto arr = json::array();
  for (auto& rt : app->getRuntimes())
  {
    arr.push_back(jsonSerialise(rt));
  }
  return makeJsonResponse(json{{"runtimes", arr}, {"registry", app->getRegistry()}});
}


crow::response Server::impl::deleteRuntime(const std::string& runtimeId)
{
  bool removedSuccessfully = app->removeRuntime(runtimeId);
  if (!removedSuccessfully)
  {
    return crow::response{crow::status::NOT_FOUND} ;      
  }
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
  return makeJsonResponse({json {{"runtimes", arr}, {"registry", app->getRegistry()}}});
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
  auto config = app->configureService(runtimeId, instanceId, body);
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

  // Build the appropriate Data variant from the request body and content type.
  auto buildInputData = [&]() -> std::optional<Data>
  {
    if (contentType == "application/json")
    {
      try
      {
        auto body = json::parse(req.body);
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
  };

  auto inputData = buildInputData();
  if (!inputData)
  {
    std::cerr << "processRuntime: cannot parse body with Content-Type: " << contentType << '\n';
    return crow::response(crow::status::BAD_REQUEST);
  }

  try
  {
    auto result = app->processRuntime(runtimeId, std::move(*inputData));

    if (auto j = getJSONFromData(result))
      return makeJsonResponse(*j);

    if (auto b = getBinaryFromData(result))
    {
      crow::response res(200);
      res.body = std::string(b->begin(), b->end());
      res.set_header("Content-Type", "application/octet-stream");
      res.set_header("Access-Control-Allow-Origin", allowedOrigins);
      return res;
    }

    if (auto s = getStringFromData(result))
    {
      crow::response res(200);
      res.body = *s;
      res.set_header("Content-Type", "text/plain");
      res.set_header("Access-Control-Allow-Origin", allowedOrigins);
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
  // are always allowed; otherwise the token (carried in ?access_token= because
  // a browser can't set headers on a handshake) must verify and be allow-listed.
  bool allowed = authenticator->isNoAuth() || isLoopbackHost(req.remote_ip_address);
  if (!allowed)
  {
    if (const char* token = req.url_params.get("access_token"))
    {
      allowed = authenticator->authorize(std::string("Bearer ") + token).status == AuthStatus::Ok;
    }
  }
  if (!allowed)
  {
    return false;  // reject the upgrade
  }
  *userdata = new WsConnState();
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

  app->dispatchRuntimeWsMessage(state->runtimeId, message, isBinary);
}

void Server::impl::wsOnClose(crow::websocket::connection& conn)
{
  auto* state = static_cast<WsConnState*>(conn.userdata());
  if (!state)
  {
    return;
  }
  {
    std::lock_guard<std::mutex> lock(wsMutex);
    auto it = wsByRuntime.find(state->runtimeId);
    if (it != wsByRuntime.end())
    {
      it->second.erase(&conn);
      if (it->second.empty())
      {
        wsByRuntime.erase(it);
      }
    }
  }
  delete state;
  conn.userdata(nullptr);
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

void Server::setAllowedUsers(const std::vector<std::string>& emails)
{
  m_impl->authenticator->setAllowedEmails(emails);
}

}
