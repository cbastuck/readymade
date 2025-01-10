#include "registry.h"

#if IS_MACOS
  #include "./services/core_input.h"
  #include "./services/core_output.h"
#endif

#include "./services/websocket_writer.h"
#include "./services/websocket_reader.h"
#include "./services/websocket_service.h"

std::shared_ptr<Service> Registry::create(std::string serviceId, std::string instanceId)
{
#if IS_MACOS
  if (serviceId == "core-input")
  {
    return std::make_shared<CoreInput>(instanceId);
  }
  if (serviceId == "core-output")
  {
    return std::make_shared<CoreOutput>(instanceId);
  }
#endif
  if (serviceId == "websocket-writer")
  {
    return std::make_shared<WebsocketWriter>(instanceId);
  }
  if (serviceId == "websocket-reader")
  {
    return std::make_shared<WebsocketReader>(instanceId);
  }
  if (serviceId == "websocket-socket")
  {
    return std::make_shared<WebsocketService>(instanceId);
  }
  return nullptr;
}

std::vector<ServiceClass> Registry::availableServices()
{
  return {
#if IS_MACOS
      {"core-input"},
      {"core-output"},
#endif
      {"websocket-writer"},
      {"websocket-reader"},
      {"websocket-socket"}};
}