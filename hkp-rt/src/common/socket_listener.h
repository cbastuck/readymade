#pragma once

#include <boost/asio.hpp>
#include <boost/beast.hpp>

#include <functional>

#include <types/owns_me.h>

namespace net = boost::asio;            // from <boost/asio.hpp>
namespace beast = boost::beast;         // from <boost/beast.hpp>
using tcp = boost::asio::ip::tcp;       // from <boost/asio/ip/tcp.hpp>

class Websocket;

class SocketListener
{
public:
  SocketListener(Websocket& owner);
  ~SocketListener();

  unsigned short getBoundPort() const;

private:
  void run();
  void do_accept();
  void on_accept(beast::error_code ec, tcp::socket socket);
  void fail(beast::error_code ec, char const* what);

private:
  net::io_context m_ioc;
  tcp::acceptor m_acceptor;
  std::thread m_t;
  OwnsMe<Websocket> m_owner;
};
