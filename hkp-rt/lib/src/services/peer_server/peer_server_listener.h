#pragma once

#include <memory>
#include <string>
#include <thread>

#include <boost/asio.hpp>
#include <boost/beast.hpp>

#include <mounts.h>

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
  // Served from a mount: nothing is bound, and `adopt` is how a connection
  // arrives. See mounts.h.
  explicit PeerServerListener(std::shared_ptr<PeerRegistry> registry);
  ~PeerServerListener();

  void adopt(MountedConnection connection);

  unsigned short getBoundPort() const;

private:
  void run();
  void do_accept();
  void on_accept(boost::beast::error_code ec, boost::asio::ip::tcp::socket socket);

  boost::asio::io_context m_ioc{1};
  std::unique_ptr<boost::asio::executor_work_guard<boost::asio::io_context::executor_type>> m_work;
  boost::asio::ip::tcp::acceptor m_acceptor;
  std::thread m_thread;
  std::shared_ptr<PeerRegistry> m_registry;
  std::string m_basePath;
};

} // namespace hkp
