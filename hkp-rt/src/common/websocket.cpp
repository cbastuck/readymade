#include "./websocket.h"

#include "./socket_listener.h"
#include "./socket_session.h"

Websocket::Websocket(const WebsocketConfig& config, tListener listener)
  : m_config(config)
  , m_state{{ "mode", "writeOnly" }}
  , m_listener(listener)
{
}

Websocket::~Websocket()
{
  stop();
}

void Websocket::onSessionData(beast::flat_buffer& buffer, bool isBinary)
{
  m_listener(buffer, isBinary);
}

void Websocket::onNewSession(const std::shared_ptr<SocketSession>& session)
{
  m_connections.push_back(session);
}

void Websocket::start()
{
  if (m_socketListener)
  {
    stop();
  }
  m_socketListener = std::make_unique<SocketListener>(*this);
}

void Websocket::stop()
{
  m_connections.clear();
  if (m_socketListener)
  {
    m_socketListener.reset();
  }
}

void Websocket::send(const Data& data) 
{
  for (auto& c : m_connections)
  {
    c->send(data);
  }
}

const WebsocketConfig& Websocket::getConfig() const
{
  return m_config;
}

unsigned short Websocket::getBoundPort() const
{
  return m_socketListener ? 
    m_socketListener->getBoundPort() : 
    0;
}