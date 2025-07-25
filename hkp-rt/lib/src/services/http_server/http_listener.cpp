#include "./http_listener.h"

#include "./http_server_impl.h"
#include "./http_session.h"

namespace net = boost::asio;
namespace beast = boost::beast;
namespace http = beast::http;

namespace hkp {

inline void fail(boost::beast::error_code ec, char const* what)
{
  std::cerr << what << ": " << ec.message() << "\n";
}

Listener::Listener(HttpServerImpl& impl, tcp::endpoint endpoint)
        : m_impl(impl)
        , acceptor_(net::make_strand(impl.getIOContext()))
        
{
    beast::error_code ec;
    acceptor_.open(endpoint.protocol(), ec);
    if(ec)
    {
      fail(ec, "Listener::Listener() open");
      return;
    }

    // Allow address reuse
    acceptor_.set_option(net::socket_base::reuse_address(true), ec);
    if(ec)
    {
      fail(ec, "Listener::Listener() set_option");
      return;
    }

    // Bind to the server address
    acceptor_.bind(endpoint, ec);
    if(ec)
    {
      fail(ec, "Listener::Listener() bind");
      return;
    }

    // Start listening for connections
    acceptor_.listen(net::socket_base::max_listen_connections, ec);
    if(ec)
    {
      fail(ec, "Listener::Listener() listen");
      return;
    }
}

Listener::~Listener()
{
   stop();
}

unsigned short Listener::start()
{
    do_accept();
    return acceptor_.local_endpoint().port();
}

bool Listener::stop() 
{
  beast::error_code ec;
  acceptor_.close(ec);
  if (ec) 
  {
      std::cerr << "Listener::stop Error closing acceptor: " << ec.message() << "\n";
      return false;
  }
  return true;
}

void Listener::onSessionOpened(std::shared_ptr<Session> session)
{
    m_impl.onSessionOpened(session);
}

void Listener::onSessionClosed(std::shared_ptr<Session> session)
{
    m_impl.onSessionClosed(session);
}

void Listener::do_accept()
{
    // The new connection gets its own strand
    acceptor_.async_accept(
        net::make_strand(m_impl.getIOContext()),
        beast::bind_front_handler(
            &Listener::on_accept,
            shared_from_this()));
}

void Listener::on_accept(beast::error_code ec, tcp::socket socket)
{
  if(ec)
  {
    fail(ec, "Listener::on_accept accept");
  }
  else
  {
    std::make_shared<Session>(*this, std::move(socket))->run();
  }

  // Accept another connection
  do_accept();
}

} // namespace hkp