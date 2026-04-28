#include "peer_server_listener.h"

#include "peer_server_session.h"

#include <iostream>

namespace beast = boost::beast;
namespace net   = boost::asio;
using tcp       = net::ip::tcp;

namespace hkp {

PeerServerListener::PeerServerListener(std::shared_ptr<PeerRegistry> registry,
                                       unsigned short port,
                                       std::string basePath)
  : m_acceptor(m_ioc)
  , m_registry(std::move(registry))
  , m_basePath(std::move(basePath))
{
  beast::error_code ec;

  auto const address = net::ip::make_address("0.0.0.0");
  tcp::endpoint endpoint{address, port};

  m_acceptor.open(endpoint.protocol(), ec);
  if (ec) { std::cerr << "PeerServerListener open: " << ec.message() << "\n"; return; }

  m_acceptor.set_option(net::socket_base::reuse_address(true), ec);
  if (ec) { std::cerr << "PeerServerListener set_option: " << ec.message() << "\n"; return; }

  m_acceptor.bind(endpoint, ec);
  if (ec) { std::cerr << "PeerServerListener bind: " << ec.message() << "\n"; return; }

  m_acceptor.listen(net::socket_base::max_listen_connections, ec);
  if (ec) { std::cerr << "PeerServerListener listen: " << ec.message() << "\n"; return; }

  m_thread = std::thread([this] { run(); });
}

PeerServerListener::~PeerServerListener()
{
  m_acceptor.close();
  m_ioc.stop();
  if (m_thread.joinable())
  {
    m_thread.join();
  }
}

unsigned short PeerServerListener::getBoundPort() const
{
  return m_acceptor.local_endpoint().port();
}

void PeerServerListener::run()
{
  std::cout << "PeerServerListener::run() port=" << getBoundPort() << "\n";
  do_accept();
  m_ioc.run();
  std::cout << "PeerServerListener::run() stopped\n";
}

void PeerServerListener::do_accept()
{
  m_acceptor.async_accept(
    net::make_strand(m_ioc),
    beast::bind_front_handler(&PeerServerListener::on_accept, this));
}

void PeerServerListener::on_accept(beast::error_code ec, tcp::socket socket)
{
  if (ec == net::error::operation_aborted)
  {
    return;
  }

  if (!ec)
  {
    auto session = std::make_shared<PeerServerSession>(
      std::move(socket), m_registry, m_basePath);
    session->run();
  }
  else
  {
    std::cerr << "PeerServerListener::on_accept: " << ec.message() << "\n";
  }

  do_accept();
}

} // namespace hkp
