#pragma once

#include <functional>

#include <boost/beast.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <types/owns_me.h>
#include <types/data.h>
#include <types/message.h>

#include "./websocket_protocol.h"

namespace hkp
{

  class WebsocketServer;

  class WebsocketServerSession
  {
  public:
  explicit WebsocketServerSession(boost::asio::ip::tcp::socket&& socket, OwnsMe<WebsocketServer> service);
    ~WebsocketServerSession();

    bool isOpen() const;
  void send(const Data& data, MessagePurpose purpose, const std::string& sender);

    inline unsigned int getSessionId() const { return m_sessionId; }

  private:
    void onStop();

    void on_run();
    void on_accept(boost::beast::error_code ec);
    void do_read();
    void on_read(boost::beast::error_code ec, std::size_t bytes_transferred);
    void on_write(boost::beast::error_code ec, std::size_t bytes_transferred);

  private:
  void fail(boost::beast::error_code ec, char const* what);

    unsigned int m_sessionId;
    std::optional<WebsocketProtocol> m_protocol;
    std::unique_ptr<boost::beast::websocket::stream<boost::beast::tcp_stream>> m_ws;
    boost::beast::flat_buffer m_readBuffer;
    OwnsMe<WebsocketServer> m_owner;

    volatile bool m_isSending = false;
    boost::asio::executor_work_guard<boost::beast::websocket::stream<boost::asio::ip::tcp::socket>::executor_type> m_guard;
  };

}
