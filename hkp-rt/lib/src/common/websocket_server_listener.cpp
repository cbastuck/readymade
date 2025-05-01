#include "./websocket_server_listener.h"

#include "./websocket_server.h"
#include "./websocket_server_session.h"

namespace net = boost::asio;            // from <boost/asio.hpp>
namespace beast = boost::beast;         // from <boost/beast.hpp>
using tcp = boost::asio::ip::tcp;       // from <boost/asio/ip/tcp.hpp>

namespace hkp {

WebsocketServerListener::WebsocketServerListener(WebsocketServer& owner)
        : m_ioc{1}
        , m_acceptor(m_ioc)
        , m_owner(&owner)
{
  const auto& config = m_owner->getConfig();
  unsigned short port = config.portAsNumber();
  auto const address = net::ip::make_address(config.host);
  tcp::endpoint endpoint{address, port};

  beast::error_code ec;
  m_acceptor.open(endpoint.protocol(), ec);  
  if (ec)
  {
    fail(ec, "open");
    return;
  }

  // Allow address reuse
  m_acceptor.set_option(net::socket_base::reuse_address(true), ec);
  if (ec)
  {
    fail(ec, "set_option");
    return;
  }

  // Bind to the server address
  m_acceptor.bind(endpoint, ec);
  if (ec)
  {
    fail(ec, "bind");
    return;
  }

  // Start listening for connections
  m_acceptor.listen(net::socket_base::max_listen_connections, ec);
  if (ec)
  {
    fail(ec, "listen");
    return;
  }

  m_t = std::thread([this] { run(); });
}

WebsocketServerListener::~WebsocketServerListener()
{
  m_acceptor.close();
  m_ioc.stop();
  m_t.join();
}

unsigned short WebsocketServerListener::getBoundPort() const
{
  return m_acceptor.local_endpoint().port();
}

// Start accepting incoming connections
void WebsocketServerListener::run()
{
  auto port = getBoundPort();
  std::cout << "SocketListener::run() start: "<< port << std::endl;
  do_accept();
  m_ioc.run();
  std::cout << "SocketListener::run() finished: "<< port << std::endl;
}

void WebsocketServerListener::do_accept()
{
  // The new connection gets its own strand
  m_acceptor.async_accept(
      net::make_strand(m_ioc),
      beast::bind_front_handler(
          &WebsocketServerListener::on_accept,
          this));
}

void WebsocketServerListener::on_accept(beast::error_code ec, tcp::socket socket)
{
  if (ec == net::error::operation_aborted)
  {
    return;
  }

  if (!ec)
  {
     m_owner->onNewSession(
      std::make_shared<WebsocketServerSession>(std::move(socket), m_owner)
    );
  } 
  else
  {
    fail(ec, "accept");
  }
  do_accept(); // Accept another connection
}


void WebsocketServerListener::fail(beast::error_code ec, char const* what)
{
  std::cerr << what << ": " << ec.message() << "\n";
}

}
