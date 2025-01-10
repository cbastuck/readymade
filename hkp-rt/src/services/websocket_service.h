#pragma once

#include <list>
#include <boost/asio.hpp>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>

#include <common/websocket.h>

namespace net = boost::asio;

class WebsocketService : public Service
{
public:
  WebsocketService(std::string instanceId) 
    : Service(instanceId)
    , m_state{{ "mode", "writeOnly" }}
  {
  }

  ~WebsocketService()
  {
    stop();
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
      }
    }    

    if (buf.contains("running"))
    {
      auto running = buf["running"].get<bool>();
      if (running && !m_websocket)
      {
        start();
      } 
      else if (!running && m_websocket)
      {
        stop();
      }   
    }
    return getState();
  }

  void stop() 
  {
    m_websocket.reset();
  }

  Data process(Data data) override
  {
    notifyRuntime(json{{ "notification", json{{ "instanceId", m_instanceId}} }}); // TODO: 
    std::string mode = m_state["mode"];
    if (mode == "writeOnly") 
    {
      m_websocket->send(data);
    }

    return data;
  }

  std::string getServiceId() const override
  {
    return "websocket-socket";
  }

  json getState() const override
  {
    auto state = m_config.serialise();
    state.update(m_state);
    state["running"] = m_websocket != nullptr;  
    return state;
  }

  void onSessionData(beast::flat_buffer& buffer, bool isBinary)
  {
    auto data = flatBufferToData(buffer, isBinary);
    next(data); // TODO: depends on the mode
    buffer.consume(buffer.size());
  }

private:
  void start() 
  {
    m_websocket = std::make_unique<Websocket>(
      m_config, 
      std::bind(&WebsocketService::onSessionData, this, std::placeholders::_1, std::placeholders::_2)
    );
    m_websocket->start(); 
  }

private:
  WebsocketConfig m_config;
  std::unique_ptr<Websocket> m_websocket;
  json m_state;
};
