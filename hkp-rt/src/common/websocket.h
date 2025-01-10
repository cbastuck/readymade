#pragma once

#include <types/types.h>

#include <boost/beast.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <list>
#include <thread>
#include <functional>

#include "./websocket_config.h"

namespace beast = boost::beast;         // from <boost/beast.hpp>
namespace websocket = beast::websocket; // from <boost/beast/websocket.hpp>
using tcp = boost::asio::ip::tcp;       // from <boost/asio/ip/tcp.hpp>
namespace net = boost::asio;

class SocketSession;
class SocketListener;

class Websocket
{
public:
  typedef std::function<void (beast::flat_buffer& buffer, bool isBinary)> tListener;
  Websocket(const WebsocketConfig& config, tListener listener);
  ~Websocket();

  void start();
  void stop();

  void send(const Data& data);

  const WebsocketConfig& getConfig() const;
  unsigned short getBoundPort() const;

  void onSessionData(beast::flat_buffer& buffer, bool isBinary);
  void onNewSession(const std::shared_ptr<SocketSession>& session);

private:
  WebsocketConfig m_config;
  std::unique_ptr<SocketListener> m_socketListener;
  json m_state;
  std::list<std::shared_ptr<SocketSession>> m_connections;
  tListener m_listener;
  std::mutex m_mutex;
};
