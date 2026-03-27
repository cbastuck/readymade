#include "websocket_server_session.h"

#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/websocket.hpp>

#include <yas/buffers.hpp>

#include "./websocket_server.h"

#include <types/message.h>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = boost::asio::ip::tcp;
namespace websocket = beast::websocket;

static unsigned int s_sessionId = 0;

namespace hkp {

WebsocketServerSession::WebsocketServerSession(tcp::socket&& socket, OwnsMe<WebsocketServer> owner) 
        : m_sessionId(s_sessionId++)
        , m_ws(std::make_unique<websocket::stream<beast::tcp_stream>>(std::move(socket))) // takes ownership of the socket
        , m_owner(owner)
        , m_guard(m_ws->get_executor())
{
  // We need to be executing within a strand to perform async operations
  // on the I/O objects in this session. Although not strictly necessary
  // for single-threaded contexts, this example code is written to be
  // thread-safe by default.
  net::dispatch(m_ws->get_executor(),
      beast::bind_front_handler(
          &WebsocketServerSession::on_run,
          this));
}

WebsocketServerSession::~WebsocketServerSession()
{
  onStop();
}

bool WebsocketServerSession::isOpen() const
{
  return m_ws && m_ws->is_open();
}

void WebsocketServerSession::send(const Data& data, MessagePurpose purpose, const std::string& sender)
{
  if (!isOpen())
  {
    std::cout << "SocketSession::send: not open" << std::endl;
    return;
  }

  // TODO: is the following assumption correct? The protocol specifies the role of the client
  // so the server should not send data to sesseions that are connected to a writer
  if (m_protocol && m_protocol->type == "writer")
  {
    return;
  }
  if (m_isSending)
  {
    std::cout << "SocketSession::send: already sending" << std::endl;
    return;
  }

  m_isSending = true;
  try
  {
    Message::serialize(data, purpose, sender, *m_ws);
  }
  catch(...) 
  {
    std::cout << "SocketSession::send: exception" << std::endl;
    onStop();
  }
  m_isSending = false;
}

void WebsocketServerSession::on_run()
{
  // Set suggested timeout settings for the websocket
  m_ws->set_option(
      websocket::stream_base::timeout::suggested(
          beast::role_type::server));

  // Set a decorator to change the Server of the handshake
  m_ws->set_option(websocket::stream_base::decorator(
      [](websocket::response_type& res)
      {
          res.set(http::field::server,
              std::string(BOOST_BEAST_VERSION_STRING) +
                  " websocket-server-async");
      }));
  // Accept the websocket handshake
  m_ws->async_accept(
      beast::bind_front_handler(
          &WebsocketServerSession::on_accept,
          this));
}

void WebsocketServerSession::on_accept(beast::error_code ec)
{
  if (ec)
  {
    return fail(ec, "accept");
  }

  do_read();
}

void WebsocketServerSession::do_read()
{
  if (!isOpen())
  {
    return;
  }
  
  m_ws->async_read(
      m_readBuffer,
      beast::bind_front_handler(
          &WebsocketServerSession::on_read,
          this));
}

void WebsocketServerSession::on_read(beast::error_code ec, std::size_t bytes_transferred)
{
  if (!isOpen())
  {
    return;
  }

  if (ec) 
  {
    if (ec == websocket::error::closed || ec == net::error::operation_aborted) 
    {
      onStop();
      return;
    }
    
    return fail(ec, "WebsocketServerSession::on_read");
  }

  if (!m_protocol.has_value())  // the first packet is supposed to be the protocol
  {
    auto proto = beast::buffers_to_string(m_readBuffer.data());
    m_protocol = WebsocketProtocol::parse(proto);
  } 
  else 
  {
    auto isBinary = m_ws->got_binary();
    m_owner->onSessionData(m_readBuffer, isBinary);
  }
  m_readBuffer.consume(bytes_transferred);
  do_read();
}

void WebsocketServerSession::onStop()
{
  m_guard.reset();
  m_ws.reset();
}

void WebsocketServerSession::fail(beast::error_code ec, char const* what)
{
  std::cerr << what << ": " << ec.message() << "\n";  
  onStop();
}

}
