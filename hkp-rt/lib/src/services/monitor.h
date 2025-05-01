#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

class Monitor : public hkp::Service 
{
public:
  static std::string serviceId() { return "monitor"; }

  Monitor(const std::string& instanceId)
     : hkp::Service(instanceId, serviceId())
     , m_logToConsole(false)
  { 
  }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j)
    {
      if (j->contains("logToConsole"))
      {
        m_logToConsole = (*j)["logToConsole"];
      }
    }
    else
    {
      std::cerr << "Monitor service: no JSON data provided" << std::endl;
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::mergeStateWith({{ "logToConsole", m_logToConsole}});
  }

  Data process(Data data) override
  {
    if (m_logToConsole)
    {
      using namespace hkp;
      std::cout << "[MONITOR]: " << data << std::endl;
    } 
    sendNotification(data);
    return data;
  }

private:
  std::string m_recent;
  bool m_logToConsole;
};
