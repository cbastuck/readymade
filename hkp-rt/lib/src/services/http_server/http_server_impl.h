#pragma once

#include <boost/asio.hpp>
#include <boost/beast.hpp>

#include <types/types.h>
#include <mounts.h>

#include <atomic>

#include <iostream>
#include <thread>
#include <list>

namespace hkp {

class Session;
class Listener;

class HttpServerImpl
{
  using tcp = boost::asio::ip::tcp;
public:
  void resetOnSessionOpenedCallback();
  void setOnSessionOpenedCallback(std::function<void(std::shared_ptr<Session>, const std::string& path, const std::string& method)> callback);

  unsigned short start();
  bool stop();

  // Serves connections handed over by the runtime server instead of accepting
  // its own: nothing is bound, and `adopt` is how a request arrives. See
  // mounts.h.
  bool startMounted();
  void adopt(MountedConnection connection);
  void processData(Data& data);

  void onSessionOpened(std::shared_ptr<Session> session);
  void onSessionClosed(std::shared_ptr<Session> session);
  
  void setPort(unsigned short port) { m_port = port; }
  unsigned short port() const { return m_port; }

  // Whether an acceptor is bound. The port is only read when it binds, so this
  // also says whether a port change still has any effect to wait for.
  bool running() const { return m_listener != nullptr || m_mounted; }
  // Whether it is served from a mount rather than a port of its own.
  bool mounted() const { return m_mounted; }

  boost::asio::io_context& getIOContext() { return m_ioc; }

private:
  std::array<std::shared_ptr<Session>, 128> m_sessions;

  std::shared_ptr<Listener> m_listener;
  unsigned short m_port = 0; // Default port, can be set in configure
  std::atomic<bool> m_mounted{false};
  std::thread m_thread;
  std::shared_ptr<boost::asio::executor_work_guard<boost::asio::io_context::executor_type>> m_work_guard;
  boost::asio::io_context m_ioc;

  std::function<void(std::shared_ptr<Session>, const std::string& path, const std::string& method)> m_onSessionOpenedCallback;
};

} // namespace hkp