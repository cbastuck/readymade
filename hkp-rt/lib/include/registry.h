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
  const std::vector<ServiceClass>& availableServices();
  
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
  std::vector<ServiceClass> m_availableServices;
  ServiceFactoryList m_serviceList;
};

}
