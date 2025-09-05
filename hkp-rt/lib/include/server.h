#pragma once

#include <memory>
#include <string>

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
           const std::string& allowedOrigins);
    ~Server();
  
    void start(const std::string& externalIP, unsigned int port);
    void stop();
  
    unsigned int port() const;
    const std::string& externalIP() const;
    const std::string& name() const;
    const std::string& allowedOrigins() const;
    
    void handleRequest(crow::request& req, crow::response& res);

  private:
    struct impl;
    std::unique_ptr<impl> m_impl;
  };  
}
