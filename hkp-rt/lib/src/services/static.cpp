#include "./static.h"

Static::Static(const std::string& instanceId)
  : hkp::Service(instanceId, serviceId())
{

}

Static::~Static()
{

}


json Static::configure(Data data)
{
  auto d = getJSONFromData(data);
  if (d->contains("out"))
  {
    m_output = (*d)["out"];
  }
  
  return Service::configure(data);
}

std::string Static::getServiceId() const
{
  return serviceId();
}

json Static::getState() const 
{
  auto s = Service::getState();
  s.update({{"out", m_output}});
  return s;
}

Data Static::process(Data data)
{
  return Data(m_output);
}