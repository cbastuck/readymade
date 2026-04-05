#pragma once 

#include <types/types.h>
#include <service.h>

/**
 * Service Documentation
 * Service ID: wav-reader
 * Service Name: WavReader
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class WavReader : public Service
{
public:
  static std::string serviceId() { return "wav-reader"; }

  WavReader(const std::string& instanceId) 
    : Service(instanceId, serviceId())
  {
    
  }

  ~WavReader()
  {
   
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_filePath, (*buf)["filePath"]);
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
    if (!m_filePath.empty())
    {
      state["filePath"] = m_filePath;
    }
    
    
    return Service::mergeBypassState(state);
  }


  Data process(Data data = Undefined()) override
  {
    if (m_filePath.empty())
    {
      std::cerr << "WavReader service: no file path provided" << std::endl;
      return Null();
    }

    std::ifstream file(m_filePath, std::ios::binary);
    if (!file.is_open())
    {
      std::cerr << "WavReader service: failed to open file: " << m_filePath << std::endl;
      return Null();
    } 

    std::vector<uint8_t> buffer((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();

    auto pcm = readWavFile(buffer);
    if (!pcm)
    {
      std::cerr << "WavReader service: failed to read WAV file: " << m_filePath << std::endl;
      return Null();
    }

    return Data(*pcm);
  }

  std::optional<std::vector<uint8_t>> readWavFile(const std::vector<uint8_t>& buffer)
  {
    if (buffer.size() < 44) // Minimum WAV header size
    {
      std::cerr << "readWavFile: Buffer too small to contain a valid WAV file" << std::endl;
      return std::nullopt;
    }

    // Parse the WAV header
    const uint8_t* data = buffer.data();

    // Check the "RIFF" chunk descriptor
    if (std::string(data, data + 4) != "RIFF")
    {
      std::cerr << "readWavFile: Missing RIFF header" << std::endl;
      return std::nullopt;
    }

    // Check the "WAVE" format
    if (std::string(data + 8, data + 12) != "WAVE")
    {
      std::cerr << "readWavFile: Missing WAVE format" << std::endl;
      return std::nullopt;
    }

    // Locate the "fmt " subchunk
    size_t fmtChunkOffset = 12;
    while (fmtChunkOffset + 8 <= buffer.size())
    {
      std::string chunkId(data + fmtChunkOffset, data + fmtChunkOffset + 4);
      uint32_t chunkSize = *reinterpret_cast<const uint32_t*>(data + fmtChunkOffset + 4);

      if (chunkId == "fmt ")
      {
        break;
      }

      fmtChunkOffset += 8 + chunkSize;
    }

    if (fmtChunkOffset + 8 > buffer.size())
    {
      std::cerr << "readWavFile: Missing fmt chunk" << std::endl;
      return std::nullopt;
    }

    // Parse the "fmt " chunk
    uint16_t audioFormat = *reinterpret_cast<const uint16_t*>(data + fmtChunkOffset + 8);
    uint16_t numChannels = *reinterpret_cast<const uint16_t*>(data + fmtChunkOffset + 10);
    uint32_t sampleRate = *reinterpret_cast<const uint32_t*>(data + fmtChunkOffset + 12);
    uint16_t bitsPerSample = *reinterpret_cast<const uint16_t*>(data + fmtChunkOffset + 22);

    if (audioFormat != 1) // PCM format
    {
      std::cerr << "readWavFile: Unsupported audio format (only PCM is supported)" << std::endl;
      return std::nullopt;
    }

    if (bitsPerSample != 16)
    {
      std::cerr << "readWavFile: Unsupported bits per sample (only 16-bit is supported)" << std::endl;
      return std::nullopt;
    }

    // Locate the "data" subchunk
    size_t dataChunkOffset = fmtChunkOffset + 8 + *reinterpret_cast<const uint32_t*>(data + fmtChunkOffset + 4);
    while (dataChunkOffset + 8 <= buffer.size())
    {
      std::string chunkId(data + dataChunkOffset, data + dataChunkOffset + 4);
      uint32_t chunkSize = *reinterpret_cast<const uint32_t*>(data + dataChunkOffset + 4);

      if (chunkId == "data")
      {
        // Extract raw PCM data
        size_t dataStart = dataChunkOffset + 8;
        size_t dataEnd = dataStart + chunkSize;

        if (dataEnd > buffer.size())
        {
          std::cerr << "readWavFile: Data chunk size exceeds buffer size" << std::endl;
          return std::nullopt;
        }

        std::vector<float> floatSamples;
        const int16_t* samples = reinterpret_cast<const int16_t*>(data + dataStart);
        size_t numSamples = chunkSize / sizeof(int16_t);

        for (size_t i = 0; i < numSamples; ++i)
        {
          floatSamples.push_back(samples[i] / 32768.0f); // Normalize 16-bit PCM to float [-1.0, 1.0]
        }

        std::vector<uint8_t> pcmData(reinterpret_cast<uint8_t*>(floatSamples.data()), 
                   reinterpret_cast<uint8_t*>(floatSamples.data() + floatSamples.size()));
        return pcmData;
      }

      dataChunkOffset += 8 + chunkSize;
    }

    std::cerr << "readWavFile: Missing data chunk" << std::endl;
    return std::nullopt;
  }  

private: 
  std::string m_filePath;
};



}