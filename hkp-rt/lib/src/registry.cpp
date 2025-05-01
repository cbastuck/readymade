#include "registry.h"

#include <vector>

#include "./services/websocket_writer.h"
#include "./services/websocket_reader.h"
#include "./services/websocket_server_service.h"
#include "./services/websocket_client_service.h"
#include "./services/pro54/pro54_service.h"
#include "./services/monitor.h"
#include "./services/timer.h"
#include "./services/http_client.h"
#include "./services/static.h"
#include "./services/cache.h"

#if IS_MACOS
  #include "./services/core_input.h"
  #include "./services/core_output.h"
#endif

#ifdef AVCPP_FOUND
  #include "./services/ffmpeg.h"
#endif

using ServiceTypes = hkp::Registry::TypeList<
   WebsocketWriter
  ,WebsocketReader
  ,WebsocketServerService
  ,WebsocketClientService
  ,Pro54Service
  ,Monitor
  ,Timer
  ,HttpClient
  ,Static
  ,Cache
#ifdef AVCPP_FOUND 
  ,Ffmpeg
#endif
#if IS_MACOS
  ,CoreInput
  ,CoreOutput
#endif
>;

namespace hkp {

Registry::Registry()
{
  registerServices(ServiceTypes{});
}

Registry::~Registry()
{

}

std::shared_ptr<Service> Registry::create(std::string serviceId, std::string instanceId)
{
  for (auto& [id, factory] : m_serviceList)
  {
    if (id == serviceId)
    {
      return factory(serviceId, instanceId);
    }
  }
  return nullptr;
}

const std::vector<ServiceClass>& Registry::availableServices()
{
  if (m_availableServices.empty())
  {
    for (auto& [id, _] : m_serviceList)
    {
      m_availableServices.push_back(ServiceClass{id});
    }
  }
  return m_availableServices;
}

}
