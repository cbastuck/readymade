#pragma once

#include <boost/asio/strand.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <types/types.h>
 
class WebsocketClientSession : public std::enable_shared_from_this<WebsocketClientSession>
{
public:
  typedef std::function<void(beast::flat_buffer& buffer, std::size_t bytes_transferred, bool isBinary)> CallbackFunc;

  WebsocketClientSession(boost::asio::io_context &ioc, std::string host, std::string port, std::string path);

  bool isConnected() const;
  void signalSend(const Data& data);

  void start(std::string id, CallbackFunc callback);

  void stop();

  void close();

private:
  void fail(beast::error_code ec, char const *what);
  void on_close(beast::error_code ec);
  void send_data(const Data& data);

  void on_read(beast::error_code ec, std::size_t bytes_transferred);

private:
  boost::asio::ip::tcp::resolver m_resolver;
  beast::websocket::stream<boost::asio::ip::tcp::socket> m_ws;
  std::string m_host;
  std::string m_port;
  std::string m_path;
  
  std::atomic_flag m_isSending = ATOMIC_FLAG_INIT;
  std::atomic_flag m_isConnected = ATOMIC_FLAG_INIT;
  boost::asio::executor_work_guard<beast::websocket::stream<boost::asio::ip::tcp::socket>::executor_type> m_guard;

  beast::flat_buffer m_incomingBuffer;
  CallbackFunc m_callback;
};