#include "./websocket_writer.h"

#include <yas/buffers.hpp>

namespace hkp {

std::string WebsocketWriter::serviceId() { return "websocket-writer"; } 

WebsocketWriter::WebsocketWriter(const std::string& instanceId)
      : Service(instanceId, serviceId())
{
}

WebsocketWriter::~WebsocketWriter()
{
  stop();
}

void WebsocketWriter::start()
{
  if (m_session)
  {
    stop();
    m_ioc.restart();
  }

  if (m_config.host.empty() || m_config.port.empty() || m_config.path.empty())
  {
    throw std::runtime_error("WebsocketWriter: not configured correctly");
  }

  m_session = std::make_shared<WriterSession>(m_ioc, m_config.host, m_config.port, m_config.path);
  m_t = std::thread(&WebsocketWriter::run, this);
}

void WebsocketWriter::stop()
{
  if (m_session)
  {
    m_session->close();
    m_ioc.stop();
    m_t.join();
  }
}

json WebsocketWriter::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  { 
    m_config.update(*buf);
  }
  
  return Service::configure(data);
}

bool WebsocketWriter::onBypassChanged(bool bypass)
{
  if (bypass)
  {
    stop();
  }
  else // request to start websocket
  {
    if (!m_config.isValid())
    {
      return true; // still bypassed
    }
    start();
  }
  return bypass;
}

Data WebsocketWriter::process(Data data)
{
  if (m_session->isConnected()) 
  {
    m_session->signalSend(data);
  }

  return data;
}

std::string WebsocketWriter::getServiceId() const
{
  return serviceId();
}

json WebsocketWriter::getState() const
{
  auto state = m_config.serialise();
  return Service::mergeBypassState(state);
}

void WebsocketWriter::run()
{
  try
  {
    m_session->start("writer");
    m_ioc.run();
  } 
  catch (...)
  {
    std::cerr << "WebsocketWriter: " << std::endl;
  }
}

}
