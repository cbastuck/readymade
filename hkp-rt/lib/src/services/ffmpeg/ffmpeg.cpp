#include "./ffmpeg.h"

#include <iostream>
#include <set>
#include <map>
#include <memory>
#include <functional>
#include <filesystem>
#include <fstream>

#include "av.h"
#include "ffmpeg.h"
#include "codec.h"
#include "packet.h"
#include "videorescaler.h"
#include "audioresampler.h"
#include "avutils.h"

// API2
#include "format.h"
#include "formatcontext.h"
#include "codec.h"
#include "codeccontext.h"

#include "./detail.h"

namespace hkp {

Ffmpeg::Ffmpeg(const std::string& instanceId)
    : Service(instanceId, serviceId())
    , m_targetSampleRate(-1)
{
}

json Ffmpeg::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    updateIfNeeded(m_outputFolder, (*buf)["outputFolder"]);
    updateIfNeeded(m_targetSampleRate, (*buf)["targetSampleRate"]);
    updateIfNeeded(m_outputFormat, (*buf)["outputFormat"]);
  }

  return Service::configure(data);
}

std::string Ffmpeg::getServiceId() const
{
  return serviceId();
}

json Ffmpeg::getState() const
{ 
  return Service::mergeStateWith({
    {"outputFolder", m_outputFolder},
    {"targetSampleRate", m_targetSampleRate},
    {"outputFormat", m_outputFormat}
  });
}

Data Ffmpeg::process(Data data)
{
  auto j = getJSONFromData(data);
  if (!j)
  {
    auto custom = getCustomDataFromData(data);
    auto binaryData = getBinaryFromData(data);
    auto ringBuffer = getRingBufferFromData(data);
    if (custom && std::string(custom->type) == "murea/AudioData" && custom->data) // used by murea plugin to resample audio data
    {
      if (m_targetSampleRate == -1)
      {
        std::cerr << "Ffmpeg service: target sample rate not set, cannot resample." << std::endl;
        return Null(); 
      }
      auto buffer = static_cast<AudioData*>(custom->data);
      detail::resampleBuffer(*buffer, m_targetSampleRate);
      return data;
    }
    else if (binaryData || ringBuffer)
    {
      if (m_targetSampleRate == -1)
      {
        std::cerr << "Ffmpeg service: target sample rate not set, cannot resample." << std::endl;
        return Null(); 
      }

    
      BinaryData data;
      if (binaryData)
      {
        data = *binaryData;
      }
      else
      {
        ringBuffer->consumeAvailable(data, true);
      }

      static unsigned int counter = 0;
      std::string filename = m_outputFolder.empty() ? "" : "output_" + std::to_string(counter++ % 2) + ".mp3";
      if (!filename.empty())
      {
        auto outPath = (std::filesystem::path(m_outputFolder) / filename.c_str()).string();
        auto success = detail::convertFloatBufferToMp3(data, m_targetSampleRate, outPath);
        return success ?
          json{{ "output", outPath }} :
          json{{ "error", "Failed to process audio" }};
      }
      else // render to memory buffer instead of file
      {
        if (m_outputFormat == "mp3")
        {  
          auto outputIO = std::make_shared<MemoryIO>();
          OutputType output ("output.mp3", outputIO);
          auto success = detail::convertFloatBufferToMp3(data, m_targetSampleRate, output);
          if (!success)
          {
            std::cerr << "Ffmpeg service: failed to process audio." << std::endl;
          }
          return success ? outputIO->data() : Null();
        }
        else if (m_outputFormat == "ogg")
        {
          auto outputIO = std::make_shared<MemoryIO>();
          OutputType output ("output.ogg", outputIO);
          auto success = detail::convertFloatBufferToOgg(data, output);
          if (!success)
          {
            std::cerr << "Ffmpeg service: failed to process audio." << std::endl;
          }
          return success ? outputIO->data() : Null();
        }
        else if (m_outputFormat == "wav")
        {
          auto outputIO = std::make_shared<MemoryIO>();
          OutputType output ("output.wav", outputIO);
          auto success = detail::convertFloatBufferToWav(data, output);
          if (!success)
          {
            std::cerr << "Ffmpeg service: failed to process audio." << std::endl;
          }
          return success ? outputIO->data() : Null();
        }
        else
        {
          std::cerr << "Ffmpeg service: unsupported output format: " << m_outputFormat << std::endl;
          return Null();
        }
      }
    }
    else
    {
      std::cerr << "Ffmpeg service: invalid data type, expected JSON or murea/AudioData." << std::endl;
      return Null();
    }
  }
  std::string input = (*j)["input"];
  std::string output = (*j)["output"];
  unsigned int sampleRate = j->contains("sampleRate") ? (*j)["sampleRate"].get<unsigned int>() : 48000;
  auto outPath = (std::filesystem::path(m_outputFolder) / output).string(); 
  // check if output already exists;
  if (std::filesystem::exists(outPath))
  {
    std::cout << "Ffmpeg service: output file already exists: " << outPath << std::endl;
    return json{{ "output", outPath }};
  }
  
  return detail::processAudioDecodeEncode(input, outPath, sampleRate) ?
    json{{ "output", outPath }} :
    json{{ "error", "Failed to process audio" }};
}

} // namespace hkp
