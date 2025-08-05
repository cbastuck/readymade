#pragma once

#include <types/types.h>
#include <types/message.h>

#include <list>
#include <thread>
#include <functional>
#include <mutex>

#include "./websocket_config.h"

namespace hkp {
  class WebsocketServerSession;
  class WebsocketServerListener;
}

namespace boost {
  namespace beast {
    template<class Allocator>
    class basic_flat_buffer;
  }
}

namespace hkp 
{

using flat_buffer = boost::beast::basic_flat_buffer<std::allocator<char>>;

class WebsocketServer
{
public:
  typedef std::function<void (flat_buffer& buffer, bool isBinary)> tListener;
  WebsocketServer(const WebsocketConfig& config, tListener listener);
  ~WebsocketServer();

  void start();
  void stop();

  void send(const Data& data, MessagePurpose purpose, const std::string& sender);

  const WebsocketConfig& getConfig() const;
  unsigned short getBoundPort() const;

  void onSessionData(flat_buffer& buffer, bool isBinary);
  void onNewSession(const std::shared_ptr<WebsocketServerSession>& session);

private:
  WebsocketConfig m_config;
  std::unique_ptr<WebsocketServerListener> m_socketListener;
  json m_state;
  std::list<std::shared_ptr<WebsocketServerSession>> m_connections; // TODO: not thread safe
  tListener m_listener;
  std::mutex m_mutex;
};

}
