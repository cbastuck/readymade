#pragma once 

#include <types/types.h>
#include <service.h>

#include "./transient_detector_rosa.h"

/**
 * Service Documentation
 * Service ID: transients
 * Service Name: TransientDetector
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class TransientDetector : public Service
{
public:
  static std::string serviceId() { return "transients"; }

  TransientDetector(const std::string& instanceId) 
    : Service(instanceId, serviceId())
  {
    
  }

  ~TransientDetector()
  {
   
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      
    }

    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    auto state = json{};
    
    return Service::mergeBypassState(state);
  }


  Data process(Data data = Undefined()) override
  {
    auto binaryData = getBinaryFromData(data);
    if (!binaryData)
    {
      std::cerr << "TransientDetector service: no binary data provided" << std::endl;
      return Null();
    }

    std::vector<float> pcm_data = convertBinaryToFloatVector(*binaryData);
    auto onsets = rosa::detect_beats(pcm_data);
    auto arr = json::array();
    for (float onset : onsets)
    {
      arr.push_back(onset);
    }

    return Data(arr);
  }

  std::vector<float> convertBinaryToFloatVector(const std::vector<uint8_t>& binaryData)
  {
    std::vector<float> floatVector;
    floatVector.reserve(binaryData.size() / sizeof(float));

    for (size_t i = 0; i < binaryData.size(); i += sizeof(float))
    {
      float value = *reinterpret_cast<const float*>(&binaryData[i]);
      floatVector.push_back(value);
    }

    return floatVector;
  }

};

}