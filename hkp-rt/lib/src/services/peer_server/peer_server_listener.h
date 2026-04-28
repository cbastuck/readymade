#pragma once

#include <memory>
#include <string>
#include <thread>

#include <boost/asio.hpp>
#include <boost/beast.hpp>

namespace hkp {

class PeerRegistry;

// Accepts TCP connections on a dedicated io_context thread and spawns a
// PeerServerSession for each one.
class PeerServerListener
{
public:
  PeerServerListener(std::shared_ptr<PeerRegistry> registry,
                     unsigned short port,
                     std::string basePath);
  ~PeerServerListener();

  unsigned short getBoundPort() const;

private:
  void run();
  void do_accept();
  void on_accept(boost::beast::error_code ec, boost::asio::ip::tcp::socket socket);

  boost::asio::io_context m_ioc{1};
  boost::asio::ip::tcp::acceptor m_acceptor;
  std::thread m_thread;
  std::shared_ptr<PeerRegistry> m_registry;
  std::string m_basePath;
};

} // namespace hkp
