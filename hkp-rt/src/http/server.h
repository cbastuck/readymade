#pragma once

#define CROW_USE_BOOST 1
#include <crow/crow_all.h>

#include <types/types.h>

class App;

class Server
{
public:
  Server(std::shared_ptr<App> app);

  void start(unsigned int port);

private:
  void setupRoutes();

  crow::response getRuntimes();
  crow::response deleteRuntime(const std::string& runtimeId);
  crow::response deleteAllRuntimes();
  crow::response createRuntime(const crow::request &req);
  crow::response configureService(
    const crow::request &req,
    const std::string& runtimeId, 
    const std::string& instanceId
  );
  crow::response getRuntimeById(const std::string& id);

private:
  crow::Crow<crow::CORSHandler> m_crow;
  std::shared_ptr<App> m_app;
};