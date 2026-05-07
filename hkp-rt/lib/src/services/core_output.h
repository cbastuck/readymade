#pragma once

#include <iostream>
#include <CoreAudio/CoreAudio.h>

#include "./core_audio.h"
#include <service.h>
#include <types/types.h>
#include "../sub_runtime.h"
#include "../uuid.h"

/**
 * Service Documentation
 * Service ID: core-output
 * Service Name: CoreOutput
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class CoreOutput : public Service
{
public:
  static std::string serviceId() { return "core-output"; }
  static std::vector<std::string> capabilities() { return {"subservices"}; }

  CoreOutput(const std::string& instanceId)
      : Service(instanceId, serviceId())
      , m_state({{"mode", "acquire-buffer"}})
  {
    m_bypass = true;
  }

  ~CoreOutput()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_preferredOutputDeviceName, (*buf)["preferredOutputDeviceName"]);
      updateIfNeeded(m_preferredSampleRate, (*buf)["preferredSampleRate"]);
      updateIfNeeded(m_preferredBufferSize, (*buf)["preferredBufferSize"]);

      auto mode = (*buf)["mode"];
      if (mode == "buffer-incoming")
      {
        if (!m_buffer)
        {
          m_buffer = std::make_shared<FloatRingBuffer>(getId());
        }
      }
      else if (mode == "acquire-buffer" && m_buffer)
      {
        m_buffer.reset();
      }

      if (buf->contains("pipeline") && (*buf)["pipeline"].is_array())
      {
        m_subserviceConfig.clear();
        for (const auto& cfg : (*buf)["pipeline"])
          m_subserviceConfig.push_back(cfg);
        rebuildSubservices();
      }
      else if (buf->contains("appendService"))
      {
        auto svcCfg = (*buf)["appendService"];
        if (!svcCfg.contains("instanceId") || svcCfg["instanceId"].get<std::string>().empty())
          svcCfg["instanceId"] = generateUUID();
        syncSubserviceStates();
        m_subserviceConfig.push_back(std::move(svcCfg));
        rebuildSubservices();
      }
      else if (buf->contains("removeService") && (*buf)["removeService"].is_string())
      {
        const std::string id = (*buf)["removeService"].get<std::string>();
        syncSubserviceStates();
        m_subserviceConfig.erase(
          std::remove_if(m_subserviceConfig.begin(), m_subserviceConfig.end(),
            [&id](const json& cfg) { return cfg.value("instanceId", "") == id; }),
          m_subserviceConfig.end());
        rebuildSubservices();
      }
      else if (buf->contains("configureService") && (*buf)["configureService"].is_object())
      {
        const auto& cfg = (*buf)["configureService"];
        if (cfg.contains("instanceId") && cfg.contains("state") && m_subservices)
        {
          const std::string id = cfg["instanceId"].get<std::string>();
          for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
          {
            if ((*it)->getId() == id)
            {
              (*it)->configure(cfg["state"]);
              syncSubserviceStates();
              break;
            }
          }
        }
      }
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    json pipeline = json::array();
    if (m_subservices)
    {
      for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
      {
        pipeline.push_back(json{
          {"serviceId", (*it)->getServiceId()},
          {"instanceId", (*it)->getId()},
          {"state", (*it)->getState()}
        });
      }
    }
    return Service::mergeStateWith({
      {"mode", m_buffer ? "buffer-incoming" : "no-buffer"},
      {"pipeline", pipeline},
      {"currentDeviceName", CoreAudioGetOutputDeviceName(m_outputDeviceID)},
      {"availableDevices", CoreAudioEnumerateAvailableDevices()},
      {"preferredOutputDeviceName", m_preferredOutputDeviceName},
      {"sampleRate", m_sampleRate},
      {"bufferSize", m_bufferSize},
      {"availableSampleRates", m_outputDeviceID ? CoreAudioGetAvailableSampleRates(m_outputDeviceID) : json::array()},
    });
  }

  Data process(Data data = Undefined()) override
  {
    auto rb = getRingBufferFromData(data);
    if (rb && m_buffer) // true if we hold the buffer and append process data
    {
      rb->consumeAvailable(*m_buffer);
    }
    return data;
  }

private:
  void start()
  {
    OSStatus status;
    status = m_preferredOutputDeviceName.empty()
      ? CoreAudioGetDefaultOutputDevice(&m_outputDeviceID)
      : CoreAudioGetOutputDeviceByName(&m_outputDeviceID, m_preferredOutputDeviceName);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to get output device" << std::endl;
      return;
    }

    std::string deviceName = CoreAudioGetOutputDeviceName(m_outputDeviceID);
    std::cout << "Using output device: " << deviceName << std::endl;

    if (m_preferredSampleRate > 0)
    {
      status = CoreAudioSetSampleRate(m_outputDeviceID, m_preferredSampleRate);
      if (status != 0)
        std::cerr << "CoreOutput::start(): Failed to set sample rate to " << m_preferredSampleRate << std::endl;
    }
    double sampleRate = 0;
    CoreAudioGetSampleRate(m_outputDeviceID, &sampleRate);
    m_sampleRate = sampleRate;

    UInt32 targetBufferSize = m_preferredBufferSize > 0 ? m_preferredBufferSize : BUFFER_SIZE;
    status = CoreAudioSetBufferSize(m_outputDeviceID, targetBufferSize);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to set output device buffer size" << std::endl;
      return;
    }
    m_bufferSize = targetBufferSize;

    status = AudioDeviceCreateIOProcID(m_outputDeviceID, CoreOutput::onAudioOutput, this, &m_outputIOProcID);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to create output device IO proc" << std::endl;
      return;
    }

    status = AudioDeviceStart(m_outputDeviceID, m_outputIOProcID);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to start output device" << std::endl;
      return;
    }
  }

  void stop()
  {
    if (m_outputIOProcID == NULL)
    {
      return;
    }
    
    OSStatus status = AudioDeviceStop(m_outputDeviceID, m_outputIOProcID);
    if (status != 0)
    {
      
      std::cerr << "CoreOutput::stop(): Failed to stop output device: " << status << std::endl;
      return;
    }

    status = AudioDeviceDestroyIOProcID(m_outputDeviceID, m_outputIOProcID);
    if (status != 0)
    {
      std::cerr << "CoreOutput::stop():Failed to destroy output device IO proc" << std::endl;
      return;
    }
    
    m_outputIOProcID = NULL;
  }

  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      stop();
    }
    else
    {
      start(); 
    }
    return bypass;
  }

  static OSStatus onAudioOutput(AudioDeviceID device,
                                const AudioTimeStamp *now,
                                const AudioBufferList *inputData,
                                const AudioTimeStamp *inputTime,
                                AudioBufferList *outputData,
                                const AudioTimeStamp *outputTime,
                                void *userData)
  {
    CoreOutput *pThis = (CoreOutput *)userData;

    AudioStreamBasicDescription StreamFormat = {0};
    OSStatus Error = CoreAudioGetSampleFormat(device, kAudioObjectPropertyScopeOutput, &StreamFormat);

    assert(!Error && "CoreOutput::onAudioOutput(): Failed to get output device sample format");

    UInt32 streamIsFloat = StreamFormat.mFormatFlags & kAudioFormatFlagIsFloat;
    UInt32 sampleRate = StreamFormat.mSampleRate;
    UInt32 bytesPerSample = StreamFormat.mBytesPerFrame / StreamFormat.mChannelsPerFrame;
    UInt32 channelCount = outputData->mBuffers[0].mNumberChannels;

    if (!streamIsFloat || bytesPerSample != 4)
    {
      // TODO(robin): Does CoreAudio ever deal with anything that isn't 32 bit float?
      printf("CoreOutput::onAudioOutput(): Unsupported stream format! (%d bit %s) ***\n\n",
             bytesPerSample * 8, streamIsFloat ? "float" : "int");
      assert(0);
    }

    float *outputBuffer = (float *)outputData->mBuffers[0].mData;
    UInt32 frameCount = 0;
    CoreAudioGetBufferSize(device, &frameCount);

    std::shared_ptr<FloatRingBuffer> rb;

    if (pThis->m_subservices && !pThis->m_subservices->empty())
    {
      // Subservices provide the audio — no downstream connection required.
      auto data = pThis->m_subservices->process(json{{"frameCount", frameCount}, {"channelCount", channelCount}});
      rb = getRingBufferFromData(data);
    }
    else if (pThis->isConnected())
    {
      if (pThis->m_buffer)
      {
        rb = pThis->m_buffer;
      }
      else
      {
        auto data = pThis->next(json{{"frameCount", frameCount}, {"channelCount", channelCount}});
        rb = getRingBufferFromData(data);
      }
    }

    if (rb && pThis->isBufferReady(*rb, frameCount, channelCount))
      rb->consumeBinary(outputBuffer, frameCount, channelCount);
    else
      pThis->generateSilence(outputBuffer, frameCount, channelCount);

    return 0;
  }

  void generateSilence(float *outputBuffer, unsigned int frameCount, unsigned int numChannels) const
  {
    for (unsigned int i = 0; i < frameCount; ++i)
    {
      for (unsigned int j = 0; j < numChannels; ++j)
      {
        outputBuffer[i * numChannels + j] = 0;
      }
    }
  }

  bool isBufferReady(const FloatRingBuffer& buffer, unsigned int frameCount, unsigned int numChannels) const
  {
    unsigned int availableSamples = buffer.availableCount();
    if (availableSamples < frameCount)
    {
      // std::cout << "CoreOutput::isBufferReady: not enough samples available - " << availableSamples << " < " << frameCount << std::endl;
      return false;
    }
    sendNotification(json{{"availableSamples", availableSamples}});
    return true;
  }

  void syncSubserviceStates()
  {
    if (!m_subservices)
      return;
    for (auto it = m_subservices->begin(); it != m_subservices->end(); ++it)
    {
      const auto& svc = *it;
      for (auto& cfg : m_subserviceConfig)
      {
        if (cfg.value("instanceId", "") == svc->getId())
        {
          cfg["state"] = svc->getState();
          break;
        }
      }
    }
  }

  void rebuildSubservices()
  {
    json arr = json::array();
    for (const auto& cfg : m_subserviceConfig)
      arr.push_back(cfg);
    m_subservices = createSubRuntime(arr);
  }

protected:
  bool supportsSubservices() const override { return true; }

private:
  AudioDeviceID m_outputDeviceID = 0;
  AudioDeviceIOProcID m_outputIOProcID = NULL;
  json m_state;
  std::shared_ptr<FloatRingBuffer> m_buffer;
  std::string m_preferredOutputDeviceName;
  double m_sampleRate = 0.0;
  UInt32 m_bufferSize = 0;
  double m_preferredSampleRate = 0.0;
  UInt32 m_preferredBufferSize = 0;

  std::shared_ptr<SubRuntime> m_subservices;
  std::vector<json> m_subserviceConfig;
};

}
