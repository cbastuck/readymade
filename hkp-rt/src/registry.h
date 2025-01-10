#pragma once

#include <types/types.h>

class Service;

class Registry
{
public:
  static std::shared_ptr<Service> create(std::string serviceId, std::string instanceId);
  static std::vector<ServiceClass> availableServices();
};