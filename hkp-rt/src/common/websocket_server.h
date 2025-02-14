#pragma once

#include <types/types.h>

#include <boost/beast.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <list>
#include <thread>
#include <functional>

#include "./websocket_config.h"

class WebsocketServerSession;
class WebsocketServerListener;

class WebsocketServer
{
public:
  typedef std::function<void (boost::beast::flat_buffer& buffer, bool isBinary)> tListener;
  WebsocketServer(const WebsocketConfig& config, tListener listener);
  ~WebsocketServer();

  void start();
  void stop();

  void send(const Data& data);

  const WebsocketConfig& getConfig() const;
  unsigned short getBoundPort() const;

  void onSessionData(beast::flat_buffer& buffer, bool isBinary);
  void onNewSession(const std::shared_ptr<WebsocketServerSession>& session);

private:
  WebsocketConfig m_config;
  std::unique_ptr<WebsocketServerListener> m_socketListener;
  json m_state;
  std::list<std::shared_ptr<WebsocketServerSession>> m_connections; // TODO: not thread safe
  tListener m_listener;
  std::mutex m_mutex;
};
