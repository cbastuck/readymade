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

class ReceiverSession : public std::enable_shared_from_this<ReceiverSession>
{
public:
  ReceiverSession(net::io_context &ioc, std::string host, std::string port, std::string path)
      : m_resolver(net::make_strand(ioc)),
        m_ws(net::make_strand(ioc)),
        m_host(host),
        m_port(port),
        m_path(path),
        m_guard(m_ws.get_executor())
  {
  }

  void start(std::string id, std::function<void(Data data)> callback)
  {
    m_callback = callback;
    startImpl(id);
  }

  void start(std::string id, std::shared_ptr<FloatRingBuffer> target)
  {
    m_receiveBuffer = target;
    startImpl(id);
  }

  void startImpl(const std::string &id)
  {
    auto const results = m_resolver.resolve(m_host, m_port);

    // Make the connection on the IP address we get from a lookup
    auto ep = net::connect(m_ws.next_layer(), results);
    auto hostAndPort = m_host + ':' + std::to_string(ep.port());

    // Set a decorator to change the User-Agent of the handshake
    m_ws.set_option(websocket::stream_base::decorator(
        [](websocket::request_type &req)
        {
          req.set(http::field::user_agent,
                  std::string(BOOST_BEAST_VERSION_STRING) +
                      " websocket-client-coro");
        }));

    m_ws.handshake(hostAndPort, m_path);

    std::string protocol = json{{"id", id}, {"type", "reader"}}.dump();
    m_ws.write(net::buffer(protocol));

    m_isConnected.test_and_set();

    // start reading into our buffer
    m_ws.async_read(
        m_buffer,
        beast::bind_front_handler(
             &ReceiverSession::on_read,
            shared_from_this()));
  }

  void close()
  {
    std::cout << "Receiver session - closing connection" << std::endl;
    // Close the WebSocket connection
    m_ws.async_close(websocket::close_code::normal,
                     beast::bind_front_handler(
                         &ReceiverSession::on_close,
                         shared_from_this()));
  }

private:
  void on_read(beast::error_code ec, std::size_t bytes_transferred)
  {
    if (m_ws.got_text())
    {
      on_read_messages(ec, bytes_transferred);
    } 
    else 
    {
      read_binary(ec, bytes_transferred);
    }
  }

  void on_read_messages(beast::error_code ec, std::size_t bytes_transferred)
  {
    boost::ignore_unused(bytes_transferred);
    if (ec)
    {
      return fail(ec, "on_read_messages");
    }

    if (m_callback) 
    {
      auto data = flatBufferToData(m_buffer, false);
      m_buffer.consume(m_buffer.size());
      m_callback(data);
    } 
    else 
    {
      // TODO: text data does not fit in floating point ring buffer
    }

    m_ws.async_read(
        m_buffer,
        beast::bind_front_handler(
            &ReceiverSession::on_read,
            shared_from_this()));
  }

  void read_binary(beast::error_code ec, std::size_t bytes_transferred)
  {
    boost::ignore_unused(bytes_transferred);
    if (ec)
    {
      return fail(ec, "read_binary");
    }

    FloatRingBuffer::createFromSerialised(m_buffer, bytes_transferred, *m_receiveBuffer);
    m_buffer.consume(bytes_transferred);

    m_ws.async_read(
        m_buffer,
        beast::bind_front_handler(
            &ReceiverSession::on_read,
            shared_from_this()));
  }

  void on_close(beast::error_code ec)
  {
    if (ec)
    {
      return fail(ec, "close fail");
    }

    // If we get here then the connection is closed gracefully
    std::cout << "Receiver session - closed connection" << std::endl;
  }

  void fail(beast::error_code ec, char const *what)
  {
    std::cerr << what << ": " << ec.message() << "\n";
  }

private:
  tcp::resolver m_resolver;
  websocket::stream<tcp::socket> m_ws;
  beast::flat_buffer m_buffer;
  std::string m_host;
  std::string m_port;
  std::string m_path;
  std::shared_ptr<FloatRingBuffer> m_receiveBuffer;
  std::function<void(Data)> m_callback;
  std::atomic_flag m_isConnected = ATOMIC_FLAG_INIT;
  boost::asio::executor_work_guard<websocket::stream<tcp::socket>::executor_type> m_guard;
};

}
