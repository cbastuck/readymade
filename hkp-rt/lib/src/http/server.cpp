#include "server.h"

#include <crow.h>
#include <crow/middlewares/cors.h>

#include <app.h>
#include <types/validation.h>

namespace hkp
{

struct JsonResponse : crow::response
{
  JsonResponse(const json &_body, const std::string allowedOrigins)
      : crow::response{_body.dump()}
  {
    add_header("Access-Control-Allow-Origin", allowedOrigins);
    add_header("Access-Control-Allow-Headers", "Content-Type");
    add_header("Content-Type", "application/json");
  }
};
struct Server::impl
{
  impl(std::shared_ptr<App> a, const std::string& n, const std::string& ao = "*")
    : app(a)
    , name(n)
    , allowedOrigins(ao)
  {
    setupRoutes(allowedOrigins);
  }

  void setupRoutes(const std::string& allowedOrigins)
  {
    auto& cors = crow.get_middleware<crow::CORSHandler>();
    cors.global().origin(allowedOrigins);
  
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

  JsonResponse makeJsonResponse(const json &_body)
  {
    return JsonResponse(_body, allowedOrigins);
  }

  crow::Crow<crow::CORSHandler> crow;
  std::string externalIP;
  std::shared_ptr<App> app;
  std::string name;
  std::string allowedOrigins;
};

Server::Server(
  std::shared_ptr<App> app, 
  const std::string& name,
  const std::string& allowedOrigins
) : m_impl(std::make_unique<impl>(app, name, allowedOrigins))
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
    return Data(BinaryData(req.body.begin(), req.body.end()));
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

}
