#pragma once

#include <types/types.h>
#include <service.h>

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
