#include "server.h"

#include <app.h>
#include <types/validation.h>

#include "./types.h"

Server::Server(std::shared_ptr<App> app)
    : m_app(app)
{
  setupRoutes(); 
}

void Server::setupRoutes()
{ 
  
  auto& cors = m_crow.get_middleware<crow::CORSHandler>();
  cors.global()
        .origin("http://localhost:3000");
        //.headers("Origin", "Content-Type", "Content-Length", "Accept", "Authorization", "Referer", "Sec-Fetch-Dest", "Sec-Fetch-Mode", "Sec-Fetch-Site", "User-Agent", "Accept-Encoding", "Accept-Language", "Connection", "Host", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "Cache-Control");
        //.methods("GET"_method, "POST"_method, "DELETE"_method, "PUT"_method, "OPTIONS"_method);

  CROW_ROUTE(m_crow, "/runtimes")
      .methods("GET"_method)([this]() { return getRuntimes(); }); 

  CROW_ROUTE(m_crow, "/runtimes/<string>")
      .methods("GET"_method)([this](const crow::request &req, std::string id) { return getRuntimeById(id); }); 

  CROW_ROUTE(m_crow, "/runtimes/<string>")
      .methods("DELETE"_method)([this](const crow::request &req, std::string id) { return deleteRuntime(id); });

  CROW_ROUTE(m_crow, "/runtimes")
      .methods("DELETE"_method)([this](const crow::request &req) { return deleteAllRuntimes(); });

  CROW_ROUTE(m_crow, "/runtimes")
      .methods("POST"_method)([this](const crow::request &req) -> crow::response { return createRuntime(req); }); 
  
  CROW_ROUTE(m_crow, "/runtimes/<string>/services/<string>")
      .methods("POST"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return configureService(req, runtimeId, instanceId); }); 
}

void Server::start(unsigned int port)
{
  m_crow.port(port).run();
}

crow::response Server::getRuntimes()
{
  auto arr = json::array();
  for (auto& rt : m_app->getRuntimes())
  {
    arr.push_back(jsonSerialise(rt));
  }
  return jsonresponse{arr};
}


crow::response Server::deleteRuntime(const std::string& runtimeId)
{
  bool removedSuccessfully = m_app->removeRuntime(runtimeId);
  return removedSuccessfully ? crow::response{crow::status::OK} : crow::response{crow::status::NOT_FOUND} ;  
}

crow::response Server::deleteAllRuntimes()
{
  m_app->removeAllRuntimes();
  return crow::response{crow::status::OK};
}

crow::response Server::createRuntime(const crow::request &req)
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
    auto rt = validateRuntime(it);
    if (!rt) {
      return crow::response(crow::status::BAD_REQUEST); 
    }
    auto conf = m_app->createRuntime(*rt);
    arr.push_back(jsonSerialise(conf));
  }
  return jsonresponse{json {{"runtimes", arr}, {"registry", m_app->getRegistry()}}};
}

crow::response Server::configureService(const crow::request &req, const std::string& runtimeId, const std::string& instanceId)
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
  auto config = m_app->configureService(runtimeId, instanceId, body);
  if (config.is_null())
  {
    return crow::response(crow::status::NOT_FOUND);
  }

  return jsonresponse{config};
}

crow::response Server::getRuntimeById(const std::string& id)
{
  auto rt = m_app->getRuntime(id);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return jsonresponse{jsonSerialise(*rt)};
}