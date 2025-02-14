#pragma once

#include <thread>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>

#include "./writer_session.h"

class WebsocketWriter : public Service
{
public:
  static std::string serviceId() { return "websocket-writer"; } 
  
  WebsocketWriter(const std::string& instanceId)
      : Service(instanceId, serviceId())
  {
  }

  ~WebsocketWriter()
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
      throw std::runtime_error("WebsocketWriter: not configured correctly");
    }

    m_session = std::make_shared<WriterSession>(m_ioc, m_config.host, m_config.port, m_config.path);
    m_t = std::thread(&WebsocketWriter::run, this);
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
    if (m_session->isConnected()) 
    {
      m_session->signalSend(data);
    }

    return data;
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    auto state = m_config.serialise();
    return Service::mergeBypassState(state);
  }

private:
  void run()
  {
    try
    {
      m_session->start("writer");
      m_ioc.run();
    } 
    catch (...)
    {
      std::cerr << "WebsocketWriter: " << std::endl;
    }
  }

private:
  net::io_context m_ioc;
  std::shared_ptr<WriterSession> m_session;
  std::thread m_t;

  WebsocketConfig m_config;
};