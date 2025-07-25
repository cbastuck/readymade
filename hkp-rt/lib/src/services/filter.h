#pragma once

#include <iostream>
#include <fstream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class Filter : public Service 
{
public:
  static std::string serviceId() { return "filter"; }

  Filter(const std::string& instanceId)
     : Service(instanceId, serviceId())
     , m_isOpen(false)
  { 
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  { 
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_isOpen, (*buf)["open"]);
    };
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "open", m_isOpen },
    });
  }

  Data process(Data data) override
  {
    return m_isOpen ? data : Null();
  }

private:
  bool m_isOpen;
};

}
