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

  struct AudioData
  {
    unsigned int numChannels;
    unsigned int sampleRate;
    std::vector<std::vector<float> > samples;
  };

private:
  bool processAudioDecodeEncode(const std::string& input, const std::string& out, unsigned int sampleRate);
  void resampleBuffer(AudioData& io, unsigned int dstSampleRate);

  std::string m_outputFolder;
  int m_targetSampleRate;
};
