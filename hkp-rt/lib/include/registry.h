#pragma once

#include <types/types.h>

#include <type_traits>

namespace hkp {

class Service;

class Registry
{
private:
  typedef std::shared_ptr<Service> (*ServiceFactory)(std::string, std::string);
  typedef std::tuple<std::string, ServiceFactory> ServiceTuple;

public:
  template<typename... Ts> struct TypeList {};
  typedef std::vector<ServiceTuple> ServiceFactoryList;

  Registry();
  ~Registry();

  std::shared_ptr<Service> create(std::string serviceId, std::string instanceId);
  const std::vector<ServiceClass>& availableServices() const;
  const ServiceClass* findServiceClass(const std::string& serviceId) const;
  
  // Load a plugin/bundle and call its registration function
  bool loadPlugin(const std::string& path);

  template<typename... Ts>
  void registerServices(TypeList<Ts...>)
  {
    (registerService<Ts>(), ...);
  }

  template<typename T>
  void registerService()
  {
    ServiceClass descriptor;
    descriptor.serviceId = T::serviceId();
    descriptor.capabilities = serviceCapabilities<T>();
    m_availableServices.push_back(descriptor);

    ServiceTuple tuple = ServiceTuple(
      T::serviceId(), 
      [](std::string serviceId, std::string instanceId) -> std::shared_ptr<Service>
      { 
        return std::make_shared<T>(instanceId); 
      }
    );
    m_serviceList.push_back(tuple);
  }

  template<typename T>
  class X{
    public:
      X()
      {
        Registry r;
        r.registerService<T>();
      }
    };

private:
  template<typename T, typename = void>
  struct ServiceCapabilitiesProvider
  {
    static std::vector<std::string> get()
    {
      return {};
    }
  };

  template<typename T>
  struct ServiceCapabilitiesProvider<T, std::void_t<decltype(T::capabilities())>>
  {
    static std::vector<std::string> get()
    {
      return T::capabilities();
    }
  };

  template<typename T>
  static std::vector<std::string> serviceCapabilities()
  {
    return ServiceCapabilitiesProvider<T>::get();
  }

  std::vector<ServiceClass> m_availableServices;
  ServiceFactoryList m_serviceList;
};

}
