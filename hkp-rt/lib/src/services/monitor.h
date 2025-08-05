#pragma once

#include <iostream>
#include <fstream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>


namespace hkp {

class Monitor : public Service 
{
public:
  static std::string serviceId() { return "monitor"; }

  Monitor(const std::string& instanceId)
     : Service(instanceId, serviceId())
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
      updateIfNeeded(m_fileLogPath, (*j)["fileLogPath"]);
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
    return Service::mergeStateWith({
      { "logToConsole", m_logToConsole },
      { "fileLogPath", m_fileLogPath }
    });
  }

  Data process(Data data) override
  {
    if (m_logToConsole)
    {
      using namespace hkp;
      std::cout << "[MONITOR]: " << data << std::endl;
    } 
    if (!m_fileLogPath.empty())
    {
      logToFile(data);
    }
    json notification = stringify(data);
    sendNotification(notification);
    return data;
  }

  void logToFile(Data& data)
  {
    if (m_fileLogPath.empty())
    {
      return;
    }
    if (auto json = getJSONFromData(data); json)
    {
      std::ofstream out(m_fileLogPath, std::ios::app);
      out << json->dump() << std::endl;
    }
    else if (auto binary = getBinaryFromData(data); binary)
    {
      std::ofstream out(m_fileLogPath, std::ios::binary | std::ios::app);
      out.write(reinterpret_cast<const char*>(binary->data()), binary->size());
    }
    else if (auto text = getStringFromData(data); text)
    {
      std::ofstream out(m_fileLogPath, std::ios::app);
      out << *text << std::endl;
    }
    else if (auto rb = getRingBufferFromData(data); rb)
    {
      std::ofstream out(m_fileLogPath, std::ios::app | std::ios::binary);
      std::vector<float> target;
      rb->consumeAvailable(target, false);
      out.write(reinterpret_cast<const char*>(target.data()), target.size() * sizeof(float));
    }
    else 
    {
      std::cerr << "[MONITOR]: writing to log file failed\n"; 
    }
  }

private:
  std::string m_recent;
  bool m_logToConsole;
  std::string m_fileLogPath;
};

}
