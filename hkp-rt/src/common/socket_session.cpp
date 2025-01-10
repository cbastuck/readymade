#include "socket_session.h"

#include "./websocket.h"

namespace http = beast::http;
namespace net = boost::asio;

static unsigned int s_sessionId = 0;

SocketSession::SocketSession(tcp::socket&& socket, OwnsMe<Websocket> owner) 
        : m_sessionId(s_sessionId++)
        , m_ws(std::make_unique<websocket::stream<beast::tcp_stream>>(std::move(socket))) // takes ownership of the socket
        , m_owner(owner)
{
   // We need to be executing within a strand to perform async operations
  // on the I/O objects in this session. Although not strictly necessary
  // for single-threaded contexts, this example code is written to be
  // thread-safe by default.
  net::dispatch(m_ws->get_executor(),
      beast::bind_front_handler(
          &SocketSession::on_run,
          this));
}

SocketSession::~SocketSession()
{
  m_ws.reset();
}

bool SocketSession::isOpen() const
{
  return m_ws && m_ws->is_open();
}

void SocketSession::send(const Data& data)
{
  if (!isOpen())
  {
    return;
  }
  try 
  {
    auto binary = getBinaryFromData(data);
    if (binary) 
    {
      m_ws->binary(true);
      m_ws->write(net::buffer(&(*binary)[0], binary->size())) ;
    }
    else 
    {
      m_ws->text(true);
      auto str = stringify(data);
      m_ws->write(net::buffer(str));
    }
  }
  catch(...) 
  {
    onStop();
  }
}


void SocketSession::on_run()
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
          &SocketSession::on_accept,
          this));
}

void SocketSession::on_accept(beast::error_code ec)
{
  if (ec)
  {
    return fail(ec, "accept");
  }

  do_read();
}

void SocketSession::do_read()
{
  if (!isOpen())
  {
    return;
  }
  m_ws->async_read(
      buffer_,
      beast::bind_front_handler(
          &SocketSession::on_read,
          this));
}

void SocketSession::on_read(beast::error_code ec, std::size_t bytes_transferred)
{
  if (!isOpen())
  {
    return;
  }
  boost::ignore_unused(bytes_transferred);
  if (ec) 
  {
    if (ec == websocket::error::closed || 
        ec == net::error::operation_aborted) 
    {
      onStop();
      return;
    }
    
    return fail(ec, "read");
  }

  auto isBinary = m_ws->got_binary();
  m_ws->text(isBinary);
  m_owner->onSessionData(buffer_, isBinary);

  do_read();
}

void SocketSession::onStop()
{
  m_ws.reset();
}

void SocketSession::fail(beast::error_code ec, char const* what)
{
  std::cerr << what << ": " << ec.message() << "\n";  
  onStop();
}
