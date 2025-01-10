#pragma once

#include <thread>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>

#include "./receiver_session.h"

class WebsocketReader : public Service
{
public:
  WebsocketReader(std::string instanceId) : Service(instanceId),
                                            m_buffer(std::make_shared<FloatRingBuffer>(instanceId))
  {
  }

  ~WebsocketReader()
  {
    stop();
  }

  void start()
  {
    if (m_session)
    {
      throw std::runtime_error("WebsocketReader: already started");
    }

    if (!m_config.isValid())
    {
      throw std::runtime_error("WebsocketReader: not configured correctly");
    }
    m_session = std::make_shared<ReceiverSession>(m_ioc, m_config.host, m_config.port, m_config.path);
    m_t = std::thread(&WebsocketReader::run, this);
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
    return getState();
  }

  Data process(Data data) override
  {
    return m_buffer;
  }

  std::string getServiceId() const override
  {
    return "websocket-reader";
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
      m_session->start("reader", m_buffer);
      m_ioc.run();
    } 
    catch (...)
    {
      std::cerr << "WebsocketReader: " << std::endl;
    }
  }

private:
  net::io_context m_ioc; // The io_context is required for all I/O
  std::shared_ptr<ReceiverSession> m_session;
  std::shared_ptr<FloatRingBuffer> m_buffer;
  std::thread m_t;
  WebsocketConfig m_config;
};