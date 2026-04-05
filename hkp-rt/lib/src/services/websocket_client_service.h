#pragma once

#include <thread>

#include <boost/asio.hpp>
#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>
#include <common/websocket_client_session.h>

/**
 * Service Documentation
 * Service ID: websocket-client
 * Service Name: WebsocketClientService
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class WebsocketClientService : public Service
{
public:
  static std::string serviceId() { return "websocket-client"; } 
  
  WebsocketClientService(const std::string& instanceId)
      : Service(instanceId, serviceId())
      , m_state{{ "mode", "writeOnly" }}
  {
  }

  ~WebsocketClientService()
  {
    stop();
  }

  void start()
  {
    if (m_session)
    {
      stop();
      m_ioc.restart();
    }

    if (m_config.host.empty() || m_config.port.empty() || m_config.path.empty())
    {
      throw std::runtime_error("WebsockeClient: not configured correctly");
    }

    m_session = std::make_shared<WebsocketClientSession>(m_ioc, m_config.host, m_config.port, m_config.path);
    m_t = std::thread(&WebsocketClientService::run, this);
  }

  void stop()
  {
    if (m_session)
    {
      m_session->close();
      m_ioc.stop();
      m_t.join();
    }
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    { 
      m_config.update(*buf);
    }

    auto mode = (*buf)["mode"];
    if (!mode.is_null() && 
         mode == "writeOnly" || 
         mode == "readOnly" || 
         mode == "writeProcessAcc") {
      m_state["mode"] = mode;
    }

     if (mode == "writeProcessAcc")
    {
      m_accumulated = std::make_shared<FloatRingBuffer>(m_instanceId);
    }
    
    return Service::configure(data);
  }

  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      stop();
    }
    else // request to start websocket
    {
      if (!m_config.isValid())
      {
        return true; // still bypassed
      }
      start();
    }
    return bypass;
  }

  Data process(Data data) override
  {
    std::string mode = m_state["mode"];
    if (mode == "writeOnly" || mode == "writeProcessAcc")
    {
      if (m_session->isConnected()) 
      {
        m_session->signalSend(data);
      }
    }
    
    return mode == "writeProcessAcc" ? m_accumulated : data;
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    auto state = m_config.serialise();
    state.update(m_state);
    return Service::mergeBypassState(state);
  }

  void onSessionData(beast::flat_buffer& buffer, std::size_t bytes_transferred, bool isBinary)
  {
    std::string mode = m_state["mode"];
    if (mode == "readOnly")
    {
      auto data = flatBufferToData(buffer, isBinary);
      next(data);
      return;
    }
    else if (mode == "writeProcessAcc")
    {
      FloatRingBuffer::createFromSerialised(buffer, buffer.size(), *m_accumulated);
      return;
    }
    else
    {
      std::cout << "WebsocketClientService::onSessionData() received: " << bytes_transferred << std::endl;
    }
  }

private:
  void run()
  {
    try
    {
      m_session->start(
        "client-" + m_instanceName + "-" + m_instanceId,  
        std::bind(&WebsocketClientService::onSessionData, this, std::placeholders::_1, std::placeholders::_2, std::placeholders::_3)
      );
      m_ioc.run();
    } 
    catch (...)
    {
      std::cerr << "WebsocketClientService: caught unhandled exception: " << std::endl;
    }
  }

private:
  json m_state;
  boost::asio::io_context m_ioc;
  std::shared_ptr<WebsocketClientSession> m_session;
  std::thread m_t;
  WebsocketConfig m_config;

  std::shared_ptr<FloatRingBuffer> m_accumulated; // only available when accumulating data mode
};

}
