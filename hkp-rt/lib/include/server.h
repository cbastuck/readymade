#pragma once

#include <memory>

namespace hkp 
{

  class App;

  class Server
  {
  public:
    Server(std::shared_ptr<App> app);
    ~Server();
  
    void start(unsigned int port);
    void stop();
  
  private:
    struct impl;
    std::unique_ptr<impl> m_impl;
  };  
}
