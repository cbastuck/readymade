#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class Static : public Service 
{
public:
  static std::string serviceId() { return "static"; }

  Static(const std::string& instanceId);
  ~Static();
  

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  json m_output;
};

}