#include "registry.h"

#include <type_traits>
#include <vector>

#include "./services/websocket_writer.h"
#include "./services/websocket_reader.h"
#include "./services/websocket_server_service.h"
#include "./services/websocket_client_service.h"
#include "./services/pro54/pro54_service.h"
#include "./services/monitor.h"
#include "./services/timer.h"

#if IS_MACOS
  #include "./services/core_input.h"
  #include "./services/core_output.h"
#endif


template<typename... Ts>
struct TypeList {};

using ServiceTypes = TypeList<
#if IS_MACOS
  CoreInput,
  CoreOutput,
#endif
  WebsocketWriter,
  WebsocketReader,
  WebsocketServerService,
  WebsocketClientService,
  Pro54Service,
  Monitor,
  Timer
>;

typedef std::shared_ptr<Service> (*ServiceFactory)(std::string, std::string);
typedef std::tuple<std::string, ServiceFactory> ServiceTuple;
typedef std::vector<ServiceTuple> ServiceFactoryList;

template<typename T>
void registerService(ServiceFactoryList& services)
{
  ServiceTuple tuple = ServiceTuple(
    T::serviceId(), 
    [](std::string serviceId, std::string instanceId) -> std::shared_ptr<Service>
    { 
      return std::make_shared<T>(instanceId); 
    }
  );
  services.push_back(tuple);
}

template<typename... Ts>
void registerServices(TypeList<Ts...>, ServiceFactoryList& services)
{
  (registerService<Ts>(services), ...);
}

ServiceFactoryList createServiceList()
{
  ServiceFactoryList list;
  registerServices(ServiceTypes{}, list);
  return list;
}

static ServiceFactoryList registry = createServiceList();

std::shared_ptr<Service> Registry::create(std::string serviceId, std::string instanceId)
{
  for (auto& [id, factory] : registry)
  {
    if (id == serviceId)
    {
      return factory(serviceId, instanceId);
    }
  }
  return nullptr;
}

std::vector<ServiceClass> Registry::availableServices()
{
  static std::vector<ServiceClass> availableServices;
  if (availableServices.empty())
  {
    for (auto& [id, _] : registry)
    {
      availableServices.push_back(ServiceClass{id});
    }
  }
  return availableServices;
}