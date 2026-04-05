#pragma once

#include <types/types.h>
#include <service.h>

/**
 * Service Documentation
 * Service ID: ffmpeg
 * Service Name: Ffmpeg
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class Ffmpeg : public Service 
{
public:
  static std::string serviceId() { return "ffmpeg"; }

  Ffmpeg(const std::string& instanceId);
  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  std::string m_outputFolder;
  int m_targetSampleRate;
  std::string m_outputFormat = "mp3"; // default output format
};

}
