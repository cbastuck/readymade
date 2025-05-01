#include "server.h"

#include <crow.h>
#include <crow/middlewares/cors.h>

#include <app.h>
#include <types/validation.h>

struct jsonresponse : crow::response
{
  jsonresponse(const json &_body)
      : crow::response{_body.dump()}
  {
    add_header("Access-Control-Allow-Origin", "*");
    add_header("Access-Control-Allow-Headers", "Content-Type");
    add_header("Content-Type", "application/json");
  }
};

namespace hkp
{

struct Server::impl
{
  impl(std::shared_ptr<App> a) : app(a)
  {
    setupRoutes();
  }

  void setupRoutes()
  {
    auto& cors = crow.get_middleware<crow::CORSHandler>();
    cors.global()
          .origin("*"); // "http://localhost:3000"
          //.headers("Origin", "Content-Type", "Content-Length", "Accept", "Authorization", "Referer", "Sec-Fetch-Dest", "Sec-Fetch-Mode", "Sec-Fetch-Site", "User-Agent", "Accept-Encoding", "Accept-Language", "Connection", "Host", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "Cache-Control");
          //.methods("GET"_method, "POST"_method, "DELETE"_method, "PUT"_method, "OPTIONS"_method);
  
    CROW_ROUTE(crow, "/runtimes")
        .methods("GET"_method)([this]() { return getRuntimes(); }); 
  
    CROW_ROUTE(crow, "/runtimes")
        .methods("DELETE"_method)([this](const crow::request &req) { return deleteAllRuntimes(); });
  
    CROW_ROUTE(crow, "/runtimes")
        .methods("POST"_method)([this](const crow::request &req) -> crow::response { return createRuntime(req); }); 
  
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

    CROW_ROUTE(crow, "/runtimes/<string>/services")
        .methods("POST"_method)([this](const crow::request &req, std::string runtimeId) -> crow::response { return createService(req, runtimeId); });
  
    CROW_ROUTE(crow, "/runtimes/<string>/services/<string>")
        .methods("DELETE"_method)([this](const crow::request &req, std::string runtimeId, std::string instanceId) -> crow::response { return deleteService(runtimeId, instanceId); });
    }

  crow::response getRuntimes();
  crow::response deleteRuntime(const std::string& runtimeId);
  crow::response deleteAllRuntimes();
  crow::response createRuntime(const crow::request &req);
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

  crow::Crow<crow::CORSHandler> crow;
  std::shared_ptr<App> app;
};

Server::Server(std::shared_ptr<App> app)
    : m_impl(std::make_unique<impl>(app))
{
  
}

Server::~Server()
{

}

void Server::start(unsigned int port)
{
  m_impl->crow.port(port).run();
}

void Server::stop() 
{
  m_impl->crow.stop();
}

crow::response Server::impl::getRuntimes()
{
  auto arr = json::array();
  for (auto& rt : app->getRuntimes())
  {
    arr.push_back(jsonSerialise(rt));
  }
  return jsonresponse{arr};
}


crow::response Server::impl::deleteRuntime(const std::string& runtimeId)
{
  bool removedSuccessfully = app->removeRuntime(runtimeId);
  return removedSuccessfully ? crow::response{crow::status::OK} : crow::response{crow::status::NOT_FOUND} ;  
}

crow::response Server::impl::deleteAllRuntimes()
{
  app->removeAllRuntimes();
  return crow::response{crow::status::OK};
}

crow::response Server::impl::createRuntime(const crow::request &req)
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
    if (!rt) 
    {
      return crow::response(crow::status::BAD_REQUEST); 
    }
    auto conf = app->createRuntime(*rt);
    arr.push_back(jsonSerialise(conf));
  }
  return jsonresponse{json {{"runtimes", arr}, {"registry", app->getRegistry()}}};
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

  return jsonresponse{config};
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
  return jsonresponse{state};
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
  return jsonresponse{property};
}

crow::response Server::impl::getServices(const crow::request &req, const std::string& runtimeId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  auto services = app->getServices(runtimeId);
  return jsonresponse{services};
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

  return jsonresponse{res};
}

crow::response Server::impl::deleteService(const std::string& runtimeId, const std::string& instanceId)
{
  auto rt = app->getRuntime(runtimeId);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }

  auto res = app->removeService(runtimeId, instanceId);
  return jsonresponse{res};
}

crow::response Server::impl::getRuntimeById(const std::string& id)
{
  auto rt = app->getRuntime(id);
  if (!rt)
  {
    return crow::response{crow::status::NOT_FOUND};
  }
  return jsonresponse{jsonSerialise(*rt)};
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

  return jsonresponse{res};
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
  if (contentType != "application/json")
  {
    std::cout << "Content type not supported yet: " << contentType << std::endl;
    return crow::response(crow::status::BAD_REQUEST);
  }

  try
  {
    auto body = json::parse(req.body);
    if (!body.is_object())
    {
      return crow::response(crow::status::BAD_REQUEST);
    }
    auto data = app->processRuntime(runtimeId, Data(body));
    auto j = getJSONFromData(data);
    if (j)
    {
      return jsonresponse{*j};
    }
    return crow::response(crow::status::OK);
  }
  catch(const std::exception& e)
  {
    std::cerr << "Invalid json in body: " << req.body << '\n';
    return crow::response(crow::status::BAD_REQUEST);
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
  return jsonresponse{arr};
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
      return jsonresponse{jsonSerialise(input)};
    }
  }
  return crow::response{crow::status::NOT_FOUND};
}

}
