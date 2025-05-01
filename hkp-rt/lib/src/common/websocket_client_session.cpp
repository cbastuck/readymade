#include "./websocket_client_session.h"

#include <boost/asio.hpp>
#include <boost/asio/strand.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/websocket.hpp>

#include <yas/buffers.hpp>

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = boost::asio::ip::tcp;

namespace hkp {
struct WebsocketClientSession::impl
{
  impl(boost::asio::io_context &ioc, std::string host, std::string port, std::string path)
    : m_resolver(net::make_strand(ioc))
    , m_ws(net::make_strand(ioc))
    , m_host(host)
    , m_port(port)
    , m_path(path)
    , m_guard(m_ws.get_executor())
  {

  }

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


WebsocketClientSession::WebsocketClientSession(boost::asio::io_context &ioc, std::string host, std::string port, std::string path)
: m_impl(std::make_unique<impl>(ioc, host, port, path))
{
}

WebsocketClientSession::~WebsocketClientSession()
{

}

bool WebsocketClientSession::isConnected() const
{
  return m_impl->m_isConnected.test();
}

void WebsocketClientSession::signalSend(const Data& data)
{
  if (!isConnected())
  {
    std::cout << "WebsocketClientSession::signalSend: Send binary skipped because not connected" << std::endl;
    return;
  }

  if (m_impl->m_isSending.test())
  {
    std::cout << "\rWebsocketClientSession::signalSend: Send binary skipped because already sending  ..." << std::endl;
    return;
  }

  boost::asio::post(m_impl->m_ws.get_executor(),
                    [this, data]()
                    { send_data(data); });
}

void WebsocketClientSession::send_data(const Data& data)
{
  if (auto buffer = getRingBufferFromData(data)) 
  {
    auto numAvailable = buffer->availableCount();
    if (numAvailable > 0)
    {
      m_impl->m_ws.binary(true);
      buffer->resyncIfNeeded();
      auto buf = buffer->serialise(); 
      m_impl->m_isSending.test_and_set();
      m_impl->m_ws.write(
          boost::asio::buffer(buf.data.get(), buf.size));
      m_impl->m_isSending.clear();
    }
    else
    {
      std::cout << "WebsocketClientSession::signalSend: Not enough data in RingBuffer available" << std::endl;
    }
  }
  else if (auto binary = getBinaryFromData(data))
  {
    m_impl->m_ws.binary(true);
    m_impl->m_isSending.test_and_set();
    m_impl->m_ws.write(net::buffer(&(*binary)[0], binary->size()));
    m_impl->m_isSending.clear();
  }
  else if (isUndefined(data) || isNull(data))
  {
    std::cout << "WebsocketClientSession::signalSend: Undefined or null data currently not available" << std::endl;
  }
  else if (auto str = getStringFromData(data))
  {
    m_impl->m_ws.text(true);
    m_impl->m_isSending.test_and_set();
    m_impl->m_ws.write(net::buffer(*str));
    m_impl->m_isSending.clear();
  }
  else if (auto json = getJSONFromData(data))
  {
    m_impl->m_ws.text(true);
    m_impl->m_isSending.test_and_set();
    m_impl->m_ws.write(net::buffer(json->dump()));
    m_impl->m_isSending.clear();
  }
  else 
  {
    std::cout << "WebsocketClientSession::signalSend: Data type not supported available: " << data.which() << std::endl;
  }
}

void WebsocketClientSession::start(std::string id, CallbackFunc callback)
{
  m_impl->m_callback = callback;

  auto const results = m_impl->m_resolver.resolve(m_impl->m_host, m_impl->m_port);

  // Make the connection on the IP address we get from a lookup
  auto ep = net::connect(m_impl->m_ws.next_layer(), results);
  auto hostAndPort = m_impl->m_host + ':' + std::to_string(ep.port());

  // Set a decorator to change the User-Agent of the handshake
  m_impl->m_ws.set_option(websocket::stream_base::decorator(
      [](websocket::request_type &req)
      {
        req.set(http::field::user_agent,
                std::string(BOOST_BEAST_VERSION_STRING) +
                    " websocket-client-coro");
      }));

  m_impl->m_ws.handshake(hostAndPort, m_impl->m_path);
  m_impl->m_isConnected.test_and_set();

  std::string protocol = json{{"id", id}, {"type", "readWrite"}}.dump();
  m_impl->m_ws.write(net::buffer(protocol));

  m_impl->m_ws.async_read(
    m_impl->m_incomingBuffer,
      beast::bind_front_handler(
            &WebsocketClientSession::on_read,
          shared_from_this()));
}

void WebsocketClientSession::stop()
{
  if (m_impl->m_isConnected.test_and_set())
  {
    m_impl->m_guard.reset();
    m_impl->m_ws.close(websocket::close_code::normal);
  }
}

void WebsocketClientSession::close()
{
  // Close the WebSocket connection
  m_impl->m_ws.async_close(websocket::close_code::normal,
                    beast::bind_front_handler(
                        &WebsocketClientSession::on_close,
                        shared_from_this()));
}

void WebsocketClientSession::on_close(beast::error_code ec)
{
  if (ec)
  {
    return fail(ec, "close fail");
  }
  std::cout << "Writer session - closed connection" << std::endl;
}

void WebsocketClientSession::on_read(beast::error_code ec, std::size_t bytes_transferred)
{
  if (ec)
  {
    return fail(ec, "WebsocketClientSession::on_read");
  }

  if (m_impl->m_callback)
  {
    auto isBinary = m_impl->m_ws.got_binary();
    m_impl->m_callback(m_impl->m_incomingBuffer, bytes_transferred, isBinary);
  }

  m_impl->m_incomingBuffer.consume(bytes_transferred);

  m_impl->m_ws.async_read(
    m_impl->m_incomingBuffer,
      beast::bind_front_handler(
            &WebsocketClientSession::on_read,
          shared_from_this()));
}

void WebsocketClientSession::fail(beast::error_code ec, char const *what)
{
  std::cerr << what << ": " << ec.message() << "\n";
}

}
