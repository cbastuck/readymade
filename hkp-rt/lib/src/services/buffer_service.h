#pragma once

#include <iostream>
#include <fstream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class Buffer : public Service 
{
public:
  static std::string serviceId() { return "buffer"; }

  Buffer(const std::string& instanceId)
     : Service(instanceId, serviceId())
     , m_size(10)
     , m_counter(0)
     , m_binaryMode(true)
     , m_clearBufferAfterPropagation(true)
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
      updateIfNeeded(m_size, (*buf)["size"]);
      updateIfNeeded(m_binaryMode, (*buf)["binary"]);
      updateIfNeeded(m_clearBufferAfterPropagation, (*buf)["clearBufferAfterPropagation"]);
    }
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "size", m_size },
      { "binary", m_binaryMode },
      { "clearBufferAfterPropagation", m_clearBufferAfterPropagation }
    });
  }

  Data process(Data data) override
  {
    // step 1: append the data to the buffer
    if (auto j = getJSONFromData(data); j && !m_binaryMode)
    {
      if (m_jsonBuffer.is_null())
      {
        m_jsonBuffer = json::array();
      }
      m_jsonBuffer.push_back(*j);
      ++m_counter;
    }
    else if (auto binaryData = getBinaryFromData(data); binaryData && m_binaryMode)
    {
      m_binaryBuffer.reserve(binaryData->size() + m_binaryBuffer.size());
      m_binaryBuffer.insert(m_binaryBuffer.end(), binaryData->begin(), binaryData->end());
      ++m_counter;
    }
    else if (auto ringBuffer = getRingBufferFromData(data); ringBuffer && m_binaryMode)
    {
      ringBuffer->consumeAvailableByAppend(m_binaryBuffer);
      ++m_counter;
    }
    else
    {
      std::cerr << "Buffer::process: Unsupported data type" << std::endl;
      return Null();
    }
    

    // step 2: check if we have enough data to return
    if (m_binaryMode && !m_binaryBuffer.empty() && m_counter >= m_size)
    {
      m_counter = 0;
      Data res(m_binaryBuffer);
      if (m_clearBufferAfterPropagation)
      {
        m_binaryBuffer.clear();
      }
      return res;
    }
    
    if (!m_binaryMode && !m_jsonBuffer.is_null() && m_counter >= m_size)
    {
      m_counter = 0;
      json res = m_jsonBuffer;
      if (m_clearBufferAfterPropagation)
      {
        m_jsonBuffer = json::array();
      }
      return res;
    }

    return Null();
  }

private:
  unsigned int m_size;
  unsigned int m_counter;
  json m_jsonBuffer; 
  BinaryData m_binaryBuffer;
  bool m_binaryMode;
  bool m_clearBufferAfterPropagation;
};

}
