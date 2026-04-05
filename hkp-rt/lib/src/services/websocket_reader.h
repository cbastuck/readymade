#pragma once

#include <thread>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>

#include "./receiver_session.h"

/**
 * Service Documentation
 * Service ID: websocket-reader
 * Service Name: WebsocketReader
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class WebsocketReader : public Service
{
public:
  static std::string serviceId() { return "websocket-reader"; }

  WebsocketReader(const std::string& instanceId) 
    : Service(instanceId, serviceId())
    , m_buffer(std::make_shared<FloatRingBuffer>(instanceId))
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
      stop();
      m_ioc.restart();
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
      std::cout << "WebsocketReader::stop() thread joined" << std::endl;
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
    return m_buffer;
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
      auto runWithCallback = true; // otherwise collect incoming data in shared ring buffer
      if (runWithCallback)
      {
        m_session->start("reader", [this](Data data){ next(data); });
      }
      else 
      {
        m_session->start("reader", m_buffer);
      }
      
      m_ioc.run();
      std::cout << "Finishing Websocket Reader" << std::endl;
    } 
    catch (std::runtime_error err)
    {
      std::cerr << "WebsocketReader runtime error: " << err.what() << " config: " << m_config << std::endl;
    }
    catch (...) 
    {
      std::cerr << "WebsocketReader unknown error: " << m_config << std::endl;
    }
  }

private:
  net::io_context m_ioc; // The io_context is required for all I/O
  std::shared_ptr<ReceiverSession> m_session;
  std::shared_ptr<FloatRingBuffer> m_buffer;
  std::thread m_t;
  WebsocketConfig m_config;
};

}
