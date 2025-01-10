#pragma once

#include <thread>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>

#include "./writer_session.h"

class WebsocketWriter : public Service
{
public:
  WebsocketWriter(std::string instanceId)
      : Service(instanceId)
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
      throw std::runtime_error("WebsocketWriter: already started");
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
    if (!buf.is_null())
    { 
      auto cfg = WebsocketConfig::fromJSON(buf);
      if (cfg)
      {
        m_config = *cfg;
        start();
      }
    }
    
    return getState();;
  }

  Data process(Data data) override
  {
    std::shared_ptr<FloatRingBuffer> buffer = getRingBufferFromData(data);
    if (buffer && buffer->availableCount() > 0 && m_session->isConnected())
    {
      m_session->signalSend(*buffer);
    }
    return data;
  }

  std::string getServiceId() const override
  {
    return "websocket-writer";
  }

  json getState() const override
  {
    return m_config.serialise();
  }

private:
  void run()
  {
    try
    {
      m_session->start(m_instanceId, nullptr);
      m_ioc.run();
    } catch (...)
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