#pragma once

#include <types/types.h>

#include <boost/date_time/posix_time/posix_time.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/strand.hpp>

namespace beast = boost::beast;         // from <boost/beast.hpp>
namespace http = beast::http;           // from <boost/beast/http.hpp>
namespace websocket = beast::websocket; // from <boost/beast/websocket.hpp>
namespace net = boost::asio;            // from <boost/asio.hpp>
using tcp = boost::asio::ip::tcp;       // from <boost/asio/ip/tcp.hpp>

namespace hkp {

class WriterSession : public std::enable_shared_from_this<WriterSession>
{
public:
  WriterSession(net::io_context &ioc, std::string host, std::string port, std::string path);
  void start(std::string id);
  void stop();
  
  void on_read_incoming(beast::error_code ec, std::size_t bytes_transferred);
  bool isConnected() const;
  void signalSend(const Data &data);
  void close();

private:
  void sendRingBuffer(FloatRingBuffer &buffer);
  void on_close(beast::error_code ec);
  void fail(beast::error_code ec, char const *what);

private:
  tcp::resolver m_resolver;
  websocket::stream<tcp::socket> m_ws;
  std::string m_host;
  std::string m_port;
  std::string m_path;
  
  std::atomic_flag m_isSending = ATOMIC_FLAG_INIT;
  std::atomic_flag m_isConnected = ATOMIC_FLAG_INIT;
  boost::asio::executor_work_guard<websocket::stream<tcp::socket>::executor_type> m_guard;

  beast::flat_buffer m_incomingBuffer;
};

}
