#include "./http_server_impl.h"

#include "./http_listener.h"
#include "./http_session.h"

namespace net = boost::asio;
namespace beast = boost::beast;
namespace http = beast::http;

namespace hkp {

 void HttpServerImpl::resetOnSessionOpenedCallback()
{
  m_onSessionOpenedCallback = nullptr;
}

void HttpServerImpl::setOnSessionOpenedCallback(std::function<void(std::shared_ptr<Session>, const std::string&, const std::string&)> callback)
{
  m_onSessionOpenedCallback = callback;
}

unsigned short HttpServerImpl::start()
{
  m_thread = std::thread([this]() {
    try
    {
      m_work_guard = std::make_shared<net::executor_work_guard<net::io_context::executor_type>>(net::make_work_guard(m_ioc));
      m_ioc.restart(); // Ensure io_context is reset before running again (when stopping and starting again)
      m_ioc.run();
    }
    catch (const std::exception& e)
    {
      std::cerr << "HTTP server thread exception: " << e.what() << std::endl;
    }
    std::cout << "HttpServerImpl::start() Stopped HTTP server thread" << std::endl;
  });
  
  std::cout << "HttpServerImpl::start() Starting HTTP server on port: " << m_port << std::endl;
  auto address = net::ip::make_address("0.0.0.0");
  m_listener = std::make_shared<Listener>(*this, tcp::endpoint{address, m_port});
  return m_listener->start();
}

bool HttpServerImpl::stop()
{
  std::cout << "HttpServerImpl::stop() Stopping HTTP server on port: " << m_port << std::endl;
  for (auto & session : m_sessions)
  {
    session.reset();
  }
  m_work_guard.reset();
  m_listener->stop(); // Stop accepting new connections
  m_listener.reset();
  m_ioc.stop();

  if (!m_thread.joinable())
  {
    return false;
    
  }
  m_thread.join();
  return true;
}

void HttpServerImpl::processData(Data& data)
{
  for (auto& session : m_sessions)
  {
    if (session)
    {
      session->sendDataSync(data);
    }
  }
}

void HttpServerImpl::onSessionOpened(std::shared_ptr<Session> session)
{
  // If a callback is set, just notify about the new session
  if (m_onSessionOpenedCallback)
  {
    auto path = session->getRequestPath();
    auto method = session->getRequestMethod();
    m_onSessionOpenedCallback(session, path, method);
    return; // no need to store the session here - handler will take care of it
  }
  
  for (auto& existingSession : m_sessions)
  {
    if (!existingSession)
    {
      existingSession = session; // Reuse an empty slot
      return;
    }
  }
  std::cout << "HttpServerImpl::onSessionOpened() No available session slots in HttpServerImpl" << std::endl;
}

void HttpServerImpl::onSessionClosed(std::shared_ptr<Session> session)
{
  auto it = std::find(m_sessions.begin(), m_sessions.end(), session);
  if (it != m_sessions.end())
  {
    *it = nullptr; // Mark the session as closed
    return;
  }
  // TODO: investigate further, saw this for regualar curl requests that got the correct response
  // maybe the connection is alreaedy resetted somewhere else?
  std::cerr << "HttpServerImpl::onSessionClosed() Session not found in the list of sessions." << std::endl;
}

}
