#include "./writer_session.h"

#include <yas/buffers.hpp>

namespace hkp {

WriterSession::WriterSession(net::io_context &ioc, std::string host, std::string port, std::string path)
      : m_resolver(net::make_strand(ioc)),
        m_ws(net::make_strand(ioc)),
        m_host(host),
        m_port(port),
        m_path(path),
        m_guard(m_ws.get_executor())
{
}

void WriterSession::start(std::string id)
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
  m_isConnected.test_and_set();

  std::string protocol = json{{"id", id}, {"type", "writer"}}.dump();
  m_ws.write(net::buffer(protocol));

    m_ws.async_read(
      m_incomingBuffer,
      beast::bind_front_handler(
            &WriterSession::on_read_incoming,
          shared_from_this()));
}

void WriterSession::on_read_incoming(beast::error_code ec, std::size_t bytes_transferred)
{
  if (ec)
  {
    return fail(ec, "read_dummy");
  }

  std::cout << "WriterSession::on_read_incoming(): " << beast::buffers_to_string(m_incomingBuffer.data()) << std::endl;
  m_incomingBuffer.consume(bytes_transferred);
  m_ws.async_read(
      m_incomingBuffer,
      beast::bind_front_handler(
          &WriterSession::on_read_incoming,
          shared_from_this()));
}

void WriterSession::stop()
{
  if (m_isConnected.test_and_set())
  {
    m_guard.reset();
    m_ws.close(websocket::close_code::normal);
  }
}

bool WriterSession::isConnected() const
{
  return m_isConnected.test();
}

void WriterSession::signalSend(const Data &data)
{
  if (!isConnected())
  {
    std::cout << "WriterSession::signalSend: Send binary skipped because not connected" << std::endl;
    return;
  }
  if (m_isSending.test())
  {
    std::cout << "\rWriterSession::signalSend: Send binary skipped because already sending  ..." << std::endl;
    return;
  }


  if (auto buffer = getRingBufferFromData(data)) 
  {
    if (buffer->availableCount() > 0)
    {
      boost::asio::post(m_ws.get_executor(),
                    [this, &buffer]()
                    { sendRingBuffer(*buffer); });
    }
    else
    {
      std::cout << "WriterSession::signalSend: Not enough data in RingBuffer available" << std::endl;
    }
  }
  else if (auto binary = getBinaryFromData(data))
  {
    m_ws.binary(true);
    m_isSending.test_and_set();
    m_ws.write(net::buffer(&(*binary)[0], binary->size()));
    m_isSending.clear();
  }
  else if (isUndefined(data) || isNull(data))
  {
    std::cout << "WriterSession::signalSend: Undefined or null data currently not available" << std::endl;
  }
  else if (auto str = getStringFromData(data))
  {
    m_ws.text(true);
    m_isSending.test_and_set();
    m_ws.write(net::buffer(*str));
    m_isSending.clear();
  }
  else if (auto json = getJSONFromData(data))
  {
    m_ws.text(true);
    m_isSending.test_and_set();
    m_ws.write(net::buffer(json->dump()));
    m_isSending.clear();
  }
  else 
  {
    std::cout << "WriterSession::signalSend: Data type not supported available: " << data.which() << std::endl;
  }
}

void WriterSession::close()
{
  // Close the WebSocket connection
  m_ws.async_close(websocket::close_code::normal,
                    beast::bind_front_handler(
                        &WriterSession::on_close,
                        shared_from_this()));
}

void WriterSession::sendRingBuffer(FloatRingBuffer &buffer)
{
  auto numSamples = buffer.availableCount();
  m_ws.binary(true);
  buffer.resyncIfNeeded();
  auto buf = buffer.serialise(); 

  m_isSending.test_and_set();
  m_ws.write(
      boost::asio::buffer(buf.data.get(), buf.size));
  m_isSending.clear();
}

void WriterSession::on_close(beast::error_code ec)
{
  if (ec)
  {
    return fail(ec, "close fail");
  }
  std::cout << "Writer session - closed connection" << std::endl;
}

void WriterSession::fail(beast::error_code ec, char const *what)
{
  std::cerr << what << ": " << ec.message() << "\n";
}

}
