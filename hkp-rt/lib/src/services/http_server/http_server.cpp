#include "./http_server.h"

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

#include "./http_server_impl.h"
#include "./http_listener.h"
#include "./http_session.h"

#include <thread>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace hkp {

HttpServer::HttpServer(const std::string& instanceId) 
  : Service(instanceId, serviceId())
  , m_impl(std::make_shared<HttpServerImpl>())
{
  m_bypass = true; // Start in bypass mode
}

HttpServer::~HttpServer()
{
  stop();
}

std::string HttpServer::getServiceId() const
{
  return serviceId();
}

json HttpServer::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    unsigned short port = m_impl->port();
    if (updateIfNeeded(port, (*buf)["port"])) 
    {
      m_impl->setPort(port);
    }
  }
  return Service::configure(data);
}

json HttpServer::getState() const
{
  return Service::mergeStateWith(json{
    {"port", m_impl->port()}
  }); 
}

bool HttpServer::onBypassChanged(bool bypass)
{
  if (bypass)
  {
    if (!stop())
    {
      std::cerr << "Failed to stop HTTP server on port: " << m_impl->port() << std::endl;
      return false; // Indicate that the bypass was not accepted
    }
  }
  else
  {
    if (!start())
    {
      std::cerr << "Failed to start HTTP server on port: " << m_impl->port() << std::endl;
      return false; // Indicate that the bypass was not accepted
    }
  }
  return bypass;
}

Data HttpServer::process(Data data)
{
  m_impl->processData(data);
  return data;
}

bool HttpServer::start()
{
  if (!isBypass())
  {
    std::cout << "HttpServer::start() HTTP server is already running on port: " << m_impl->port() << std::endl;
    return false;
  }

  auto port = m_impl->start();
  if (port == 0)
  {
    std::cerr << "HttpServer::start() Failed to start HTTP server, port is not set or already in use." << std::endl;
    return false;
  }

  std::cout << "HttpServer::start() HTTP server started on port: " << m_impl->port() << std::endl;
  sendNotification(json{
    {"port", m_impl->port()}
  });
  return true;
}

bool HttpServer::stop()
{
  if (isBypass())
  {
    std::cout << "HttpServer::stop() HTTP server is not running" << std::endl;
    return false;
  }
  return m_impl->stop();
}

}
