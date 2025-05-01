#include "./websocket_server.h"

#include <boost/beast.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include "./websocket_server_listener.h"
#include "./websocket_server_session.h"

namespace hkp {

WebsocketServer::WebsocketServer(const WebsocketConfig& config, tListener listener)
  : m_config(config)
  , m_state{{ "mode", "writeOnly" }}
  , m_listener(listener)
{
}

WebsocketServer::~WebsocketServer()
{
  stop();
}

void WebsocketServer::onSessionData(flat_buffer& buffer, bool isBinary)
{
  m_listener(buffer, isBinary);
}

void WebsocketServer::onNewSession(const std::shared_ptr<WebsocketServerSession>& session)
{
  m_connections.push_back(session);
}

void WebsocketServer::start()
{
  if (m_socketListener)
  {
    stop();
  }
  m_socketListener = std::make_unique<WebsocketServerListener>(*this);
}

void WebsocketServer::stop()
{
  m_connections.clear();
  if (m_socketListener)
  {
    m_socketListener.reset();
  }
}

void WebsocketServer::send(const Data& data) 
{
  for (auto& c : m_connections)
  {
    c->send(data);
  }
}

const WebsocketConfig& WebsocketServer::getConfig() const
{
  return m_config;
}

unsigned short WebsocketServer::getBoundPort() const
{
  return m_socketListener ? 
    m_socketListener->getBoundPort() : 
    0;
}

}