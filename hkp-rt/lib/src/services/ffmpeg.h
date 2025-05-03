#pragma once

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

class Ffmpeg : public hkp::Service 
{
public:
  static std::string serviceId() { return "ffmpeg"; }

  Ffmpeg(const std::string& instanceId);
  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  bool processAudioDecodeEncode(const std::string& input, const std::string& out);

  std::string m_outputFolder;
};
