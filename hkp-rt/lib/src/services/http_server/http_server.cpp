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
  m_mode = "process_on_session"; // alternative: "process_on_data"
  m_impl->setOnSessionOpenedCallback(
    [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method){ onNewSession(session, path, method); }
  );
}

HttpServer::~HttpServer()
{
  m_impl->stop();
}

void HttpServer::onNewSession(std::shared_ptr<Session> session, const std::string& path, const std::string& method, bool awaitResponse)
{
  if (m_mode == "process_on_session" && session) 
  {
    auto req = json{{"path", path}, {"method", method}};
    auto data = Data(req);
    if (!awaitResponse)
    {
      Data result = next(data, true);
      session->sendDataSync(result);
    }
    else
    {
      std::cout << "HttpServer::onNewSession" << std::endl;
      nextAsync(data, [session](Data result) {
        session->sendDataSync(result); 
      });
    }
  }
  else 
  {
    std::cerr << "HttpServer::onNewSession: should not be called in mode" << m_mode << std::endl;
  }
}

std::string HttpServer::getServiceId() const
{
  return serviceId();
}

json HttpServer::configure(Data data)
{
  if (auto buf = getJSONFromData(data))
  {
    unsigned short port = m_impl->port();
    if (updateIfNeeded(port, (*buf)["port"])) 
    {
      m_impl->setPort(port);
    }

    if (updateIfNeeded(m_mode, (*buf)["mode"]))
    {
      if (m_mode == "process_on_session")
      {
        m_impl->setOnSessionOpenedCallback(
          [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) { onNewSession(session, path, method ); }
        );
      }
      else
      {
        m_impl->resetOnSessionOpenedCallback();
      }
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
  if (m_mode == "process_on_data")
  {
    m_impl->processData(data);
  }
  
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
