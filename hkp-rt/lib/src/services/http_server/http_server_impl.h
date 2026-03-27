#pragma once

#include <boost/asio.hpp>
#include <boost/beast.hpp>

#include <types/types.h>

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
  void processData(Data& data);

  void onSessionOpened(std::shared_ptr<Session> session);
  void onSessionClosed(std::shared_ptr<Session> session);
  
  void setPort(unsigned short port) { m_port = port; }
  unsigned short port() const { return m_port; }

  boost::asio::io_context& getIOContext() { return m_ioc; }

private:
  std::array<std::shared_ptr<Session>, 128> m_sessions;

  std::shared_ptr<Listener> m_listener;
  unsigned short m_port = 0; // Default port, can be set in configure
  std::thread m_thread;
  std::shared_ptr<boost::asio::executor_work_guard<boost::asio::io_context::executor_type>> m_work_guard;
  boost::asio::io_context m_ioc;

  std::function<void(std::shared_ptr<Session>, const std::string& path, const std::string& method)> m_onSessionOpenedCallback;
};

} // namespace hkp