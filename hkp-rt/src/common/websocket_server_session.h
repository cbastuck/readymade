#pragma once

#include <functional>

#include <boost/beast.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <types/owns_me.h>
#include <types/data.h>

#include "./websocket_protocol.h"

class WebsocketServer;

class WebsocketServerSession
{
public:
  explicit WebsocketServerSession(boost::asio::ip::tcp::socket&& socket, OwnsMe<WebsocketServer> service);
  ~WebsocketServerSession();

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
  std::optional<WebsocketProtocol> m_protocol;
  std::unique_ptr<beast::websocket::stream<boost::beast::tcp_stream>> m_ws;
  beast::flat_buffer m_readBuffer;
  OwnsMe<WebsocketServer> m_owner;

  volatile bool m_isSending = false;
  boost::asio::executor_work_guard<beast::websocket::stream<boost::asio::ip::tcp::socket>::executor_type> m_guard;
};