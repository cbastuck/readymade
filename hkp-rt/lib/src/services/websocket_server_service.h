#pragma once

#include <list>
#include <boost/asio.hpp>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>
#include <common/websocket_server.h>

namespace net = boost::asio;

namespace hkp {

class WebsocketServerService : public Service
{
public:
  static std::string serviceId() { return "websocket-socket"; }  //TODO: rename

  WebsocketServerService(const std::string& instanceId) 
    : Service(instanceId, "websocket")
    , m_state{{ "mode", "writeOnly" }}
  {
  }

  ~WebsocketServerService()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_config.host, (*buf)["host"]);
      updateIfNeeded(m_config.port, (*buf)["port"]);
      updateIfNeeded(m_config.path, (*buf)["path"]);
    }

    auto mode = (*buf)["mode"];
    if (!mode.is_null() && 
         mode == "writeOnly" || 
         mode == "readOnly" || 
         mode == "writeAndAcc" || 
         mode == "readProcessWrite") {
      m_state["mode"] = mode;
    }

    if (mode == "writeAndAcc")
    {
      m_accumulated = std::make_shared<FloatRingBuffer>(m_instanceId);
    }

    return Service::configure(data);
  }

  json getState() const override
  {
    auto state = m_config.serialise();
    state.update(m_state);
    state["port"] = m_websocket ? std::to_string(m_websocket->getBoundPort()) : m_config.port; // overwrite in case of dynamic ports
    Service::mergeBypassState(state);
    return state;
  }

  void stop() 
  {
    m_websocket.reset();
  }

  Data process(Data data) override
  {
    if (!m_websocket)
    {
      std::cout << "WebsocketServer.process no websocket running" << std::endl;
      return Null();
    }

    std::string mode = m_state["mode"];
    if (mode == "writeOnly" || mode == "writeAndAcc") 
    {
      m_websocket->send(data, MessagePurpose::RESULT, getId());
    }

    return (mode == "writeAndAcc") ? m_accumulated : data;
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  void onSessionData(beast::flat_buffer& buffer, bool isBinary)
  {
    std::string mode = m_state["mode"];
    if (mode == "readOnly")
    {
      auto data = flatBufferToData(buffer, isBinary);
      next(data);
    }
    else if (mode == "writeAndAcc")
    {
      if (!m_accumulated)
      {
        throw std::runtime_error("WebsocketServer::onSessionData: no accumulation buffer available");
      }
      FloatRingBuffer::createFromSerialised(buffer, buffer.size(), *m_accumulated);
    }
    else if (mode == "readProcessWrite")
    {
      auto data = flatBufferToData(buffer, isBinary);
      auto result = next(data);
      if (!isNull(result))
      {
        m_websocket->send(result, MessagePurpose::RESULT, getId());
      }
    }
  }

  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      stop();
    }
    else // not bypassed - try to start the websocket
    {
      if (!m_config.isValid())
      {
        return true; // ie. the requested bypass change was not successful
      }
      start();
    }
    return bypass;
  }

  std::vector<ExternalServiceInput> getExternalInputs() const override
  {
    return std::vector<ExternalServiceInput>{
      ExternalServiceInput{
        .id=getName() + "-input",
        .url = m_config.toString(),
      }
    };
  }

private:
  void start() 
  {
    if (m_websocket)
    {
      std::cout << "WebsocketServer::start inconsistent state - websocket still alive" << std::endl;
      stop();
    }

    if (!m_config.isValid())
    {
      std::cout << "WebsocketServer::start not possible - invalid config" << std::endl;
      return; 
    }

    m_websocket = std::make_unique<WebsocketServer>(
      m_config, 
      std::bind(&WebsocketServerService::onSessionData, this, std::placeholders::_1, std::placeholders::_2)
    );
    m_websocket->start(); 
  }

private:
  WebsocketConfig m_config;
  std::unique_ptr<WebsocketServer> m_websocket;
  json m_state;

  std::shared_ptr<FloatRingBuffer> m_accumulated; // only available when accumulating data mode
  std::string m_proto;
};

}
