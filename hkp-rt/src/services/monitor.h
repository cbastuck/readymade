#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

class Monitor : public Service 
{
public:
  static std::string serviceId() { return "monitor"; }

  Monitor(const std::string& instanceId)
     : Service(instanceId, serviceId())
  { 
  }

  json configure(Data data) override
  {
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::getState();
  }

  Data process(Data data) override
  {
    sendNotification(data);
    return data;
  }

private:
  std::string m_recent;  
};
