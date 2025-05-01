#pragma once

#include <iostream>
#include <CoreAudio/CoreAudio.h>

#include "./core_audio.h"
#include <service.h>
#include <types/types.h>

class CoreOutput : public hkp::Service
{
public:
  static std::string serviceId() { return "core-output"; }

  CoreOutput(const std::string& instanceId)
      : hkp::Service(instanceId, serviceId())
      , m_state({{"running", false}})
  {
  }

  ~CoreOutput()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (!buf)
    {
      return false;
    }
    if (updateIfNeeded(m_state["running"], (*buf)["running"]))
    {
      m_state["running"] == true ? start() : stop();      
    }
    return getState();
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    auto state = m_state;
    return Service::mergeBypassState(state);
  }

  Data process(Data data = Undefined()) override
  {
    return data;
  }

private:
  void start()
  {
    OSStatus status;
    status = CoreAudioGetDefaultOutputDevice(&m_outputDeviceID);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to get default output device" << std::endl;
      return;
    }

    UInt32 bufferSize = 0;
    status = CoreAudioGetBufferSize(m_outputDeviceID, &bufferSize);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to get output device buffer size" << std::endl;
      return;
    }

    bufferSize = BUFFER_SIZE;
    status = CoreAudioSetBufferSize(m_outputDeviceID, bufferSize);
    if (status != 0)
    {
      std::cerr << "CoreOutput::start(): Failed to set output device buffer size" << std::endl;
      return;
    }

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

    if (pThis->isConnected())
    {
      Data data = pThis->next(json{{"frameCount", frameCount}, {"channelCount", channelCount}});
      auto buffer = getRingBufferFromData(data);
      if (buffer && pThis->isBufferReady(*buffer, frameCount, channelCount))
      {
        buffer->consumeBinary(outputBuffer, frameCount, channelCount);
      } else 
      {
        pThis->generateSilence(outputBuffer, frameCount, channelCount);
      }
    }
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
    sendNotification(json{{"availableSamples", availableSamples}});
    if (availableSamples < frameCount)
    {
      std::cout << "CoreOutput::isBufferReady: not enough samples available - " << availableSamples << " < " << frameCount << std::endl;
      return false;
    }
    return true;
  }

private:
  AudioDeviceID m_outputDeviceID = 0;
  AudioDeviceIOProcID m_outputIOProcID = NULL;
  json m_state;
};