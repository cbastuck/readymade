#pragma once

#include <boost/asio.hpp>
#include <boost/beast.hpp>

#include <functional>

#include <types/owns_me.h>

namespace hkp {

class WebsocketServer;

class WebsocketServerListener
{
public:
  WebsocketServerListener(WebsocketServer& owner);
  ~WebsocketServerListener();

  unsigned short getBoundPort() const;

private:
  void run();
  void do_accept();
  void on_accept(boost::beast::error_code ec, boost::asio::ip::tcp::socket socket);
  void fail(boost::beast::error_code ec, char const* what);

private:
  boost::asio::io_context m_ioc;
  boost::asio::ip::tcp::acceptor m_acceptor;
  std::thread m_t;
  OwnsMe<WebsocketServer> m_owner;
};

}
