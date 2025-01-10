#pragma once

#include <functional>

#include <boost/beast.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <types/owns_me.h>
#include <types/data.h>

namespace beast = boost::beast;         // from <boost/beast.hpp>
namespace websocket = beast::websocket; // from <boost/beast/websocket.hpp>
using tcp = boost::asio::ip::tcp;       // from <boost/asio/ip/tcp.hpp>

class Websocket;

class SocketSession
{
public:
  explicit SocketSession(tcp::socket&& socket, OwnsMe<Websocket> service);
  ~SocketSession();

  bool isOpen() const;
  void send(const Data& data);

  inline unsigned int getSessionId() const { return m_sessionId; }

private:
  void onStop();

  void on_run();
  void on_accept(beast::error_code ec);
  void do_read();
  void on_read(beast::error_code ec, std::size_t bytes_transferred);
  void on_write(beast::error_code ec, std::size_t bytes_transferred);

private:
  void fail(beast::error_code ec, char const* what);

  unsigned int m_sessionId;
  std::unique_ptr<websocket::stream<beast::tcp_stream>> m_ws;
  beast::flat_buffer buffer_;
  OwnsMe<Websocket> m_owner;
};