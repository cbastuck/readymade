#include "./http_server_subservices.h"

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

#include "./http_server_impl.h"
#include "./http_listener.h"
#include "./http_session.h"
#include "../../uuid.h"

#include <algorithm>
#include <thread>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace hkp {

HttpServerSubservices::HttpServerSubservices(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_shared<HttpServerImpl>())
{
  m_bypass = true; // Start in bypass mode
  m_mode = "process_on_session"; // alternative: "process_on_data"
  m_impl->setOnSessionOpenedCallback(
    [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) {
      onNewSession(session, path, method);
    }
  );
}

HttpServerSubservices::~HttpServerSubservices()
{
  m_impl->stop();
}

void HttpServerSubservices::onNewSession(std::shared_ptr<Session> session,
                                         const std::string& path,
                                         const std::string& method,
                                         bool awaitResponse)
{
  if (m_mode != "process_on_session" || !session)
  {
    std::cerr << "HttpServerSubservices::onNewSession: should not be called in mode " << m_mode << std::endl;
    return;
  }

  auto req = json{{"path", path}, {"method", method}};
  Data data(req);

  // Apply nested subservices first, then continue with outer runtime services.
  if (m_subservices && !m_subservices->empty())
  {
    data = m_subservices->process(data);
  }

  if (!awaitResponse)
  {
    Data result = next(data, true);
    session->sendDataSync(result);
    return;
  }

  nextAsync(data, [session](Data result) {
    session->sendDataSync(result);
  });
}

std::string HttpServerSubservices::getServiceId() const
{
  return serviceId();
}

json HttpServerSubservices::configure(Data data)
{
  Service::configure(data); // handle bypass

  auto buf = getJSONFromData(data);
  if (!buf)
  {
    return getState();
  }

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
        [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) {
          onNewSession(session, path, method);
        }
      );
    }
    else
    {
      m_impl->resetOnSessionOpenedCallback();
    }
  }

  if (buf->contains("pipeline") && (*buf)["pipeline"].is_array())
  {
    m_subserviceConfig.clear();
    for (const auto& cfg : (*buf)["pipeline"])
    {
      m_subserviceConfig.push_back(cfg);
    }
    rebuildSubservices();
  }
  else if (buf->contains("appendService"))
  {
    auto svcCfg = (*buf)["appendService"];
    if (!svcCfg.contains("instanceId") || svcCfg["instanceId"].get<std::string>().empty())
    {
      svcCfg["instanceId"] = generateUUID();
    }
    syncSubserviceStates();
    m_subserviceConfig.push_back(std::move(svcCfg));
    rebuildSubservices();
  }
  else if (buf->contains("removeService") && (*buf)["removeService"].is_string())
  {
    const std::string id = (*buf)["removeService"].get<std::string>();
    syncSubserviceStates();
    m_subserviceConfig.erase(
      std::remove_if(m_subserviceConfig.begin(), m_subserviceConfig.end(),
        [&id](const json& cfg) { return cfg.value("instanceId", "") == id; }),
      m_subserviceConfig.end()
    );
    rebuildSubservices();
  }
  else if (buf->contains("configureService") && (*buf)["configureService"].is_object())
  {
    const auto& cfg = (*buf)["configureService"];
    if (cfg.contains("instanceId") && cfg.contains("state") && m_subservices)
    {
      const std::string id = cfg["instanceId"].get<std::string>();
      for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
      {
        if ((*it)->getId() == id)
        {
          (*it)->configure(cfg["state"]);
          syncSubserviceStates();
          break;
        }
      }
    }
  }

  return getState();
}

json HttpServerSubservices::getState() const
{
  json pipeline = json::array();
  if (m_subservices)
  {
    for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
    {
      const auto& svc = *it;
      pipeline.push_back(json{
        {"serviceId", svc->getServiceId()},
        {"instanceId", svc->getId()},
        {"state", svc->getState()}
      });
    }
  }

  return Service::mergeStateWith(json{
    {"port", m_impl->port()},
    {"pipeline", pipeline}
  });
}

bool HttpServerSubservices::onBypassChanged(bool bypass)
{
  if (bypass)
  {
    if (!stop())
    {
      std::cerr << "Failed to stop HTTP server on port: " << m_impl->port() << std::endl;
      return false;
    }
  }
  else
  {
    if (!start())
    {
      std::cerr << "Failed to start HTTP server on port: " << m_impl->port() << std::endl;
      return false;
    }
  }
  return bypass;
}

Data HttpServerSubservices::process(Data data)
{
  if (m_mode == "process_on_data")
  {
    m_impl->processData(data);
  }

  return data;
}

bool HttpServerSubservices::start()
{
  if (!isBypass())
  {
    std::cout << "HttpServerSubservices::start() HTTP server is already running on port: " << m_impl->port() << std::endl;
    return false;
  }

  auto port = m_impl->start();
  if (port == 0)
  {
    std::cerr << "HttpServerSubservices::start() Failed to start HTTP server, port is not set or already in use." << std::endl;
    return false;
  }

  std::cout << "HttpServerSubservices::start() HTTP server started on port: " << m_impl->port() << std::endl;
  sendNotification(json{
    {"port", m_impl->port()}
  });
  return true;
}

bool HttpServerSubservices::stop()
{
  if (isBypass())
  {
    std::cout << "HttpServerSubservices::stop() HTTP server is not running" << std::endl;
    return false;
  }
  return m_impl->stop();
}

void HttpServerSubservices::syncSubserviceStates()
{
  if (!m_subservices)
  {
    return;
  }

  for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
  {
    const auto& svc = *it;
    for (auto& cfg : m_subserviceConfig)
    {
      if (cfg.value("instanceId", "") == svc->getId())
      {
        cfg["state"] = svc->getState();
        break;
      }
    }
  }
}

void HttpServerSubservices::rebuildSubservices()
{
  json arr = json::array();
  for (const auto& cfg : m_subserviceConfig)
  {
    arr.push_back(cfg);
  }
  m_subservices = createSubRuntime(arr);
}

} // namespace hkp