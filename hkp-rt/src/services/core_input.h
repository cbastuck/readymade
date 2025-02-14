#pragma once

#include <iostream>
#include <CoreAudio/CoreAudio.h>

#include <types/types.h>
#include <service.h>

#include "./core_audio.h"

class CoreInput : public Service
{
public:
  static std::string serviceId() { return "core-input"; }

  CoreInput(const std::string& instanceId) 
    : Service(instanceId, serviceId())
    , m_buffer(std::make_shared<FloatRingBuffer>(instanceId))
    , m_state({{"running", false}}) 
  {
  }

  ~CoreInput()
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
    if (m_inputIOProcID != NULL)
    {
      std::cerr << "CoreInput::start: already started" << std::endl;
      stop();
    }
    
    status = CoreAudioGetDefaultInputDevice(&m_inputDeviceID);
    if (status != 0)
    {
      std::cerr << "Failed to get default input device" << std::endl;
      return;
    }

    status = CoreAudioSetBufferSize(m_inputDeviceID, BUFFER_SIZE);
    if (status != 0)
    {
      std::cerr << "Failed to set input device buffer size" << std::endl;
      return;
    }

    status = AudioDeviceCreateIOProcID(m_inputDeviceID, onAudioInput, this, &m_inputIOProcID);
    if (status != 0)
    {
      std::cerr << "Failed to create input device IO proc" << std::endl;
      return;
    }

    status = AudioDeviceStart(m_inputDeviceID, m_inputIOProcID);
    if (status != 0)
    {
      std::cerr << "Failed to start input device" << std::endl;
      return;
    }
  }

  void stop()
  {
    if (m_inputIOProcID == NULL)
    {
      std::cerr << "CoreInput::stop: already stopped" << std::endl;
      return;
    }

    OSStatus status = AudioDeviceStop(m_inputDeviceID, m_inputIOProcID);
    if (status != 0)
    {
      std::cerr << "Failed to stop input device" << std::endl;
      return;
    }

    status = AudioDeviceDestroyIOProcID(m_inputDeviceID, m_inputIOProcID);
    if (status != 0)
    {
      std::cerr << "Failed to destroy input device IO proc" << std::endl;
      return;
    }
    m_inputIOProcID = NULL;
  }

  static OSStatus onAudioInput(AudioDeviceID device,
                               const AudioTimeStamp *now,
                               const AudioBufferList *inputData,
                               const AudioTimeStamp *inputTime,
                               AudioBufferList *outputData,
                               const AudioTimeStamp *outputTime,
                               void *userData)
  {
    CoreInput *pThis = (CoreInput *)userData;

    UInt32 frameCount = 0;
    CoreAudioGetBufferSize(device, &frameCount);

    AudioStreamBasicDescription streamFormat = {0};
    OSStatus error = CoreAudioGetSampleFormat(device, kAudioObjectPropertyScopeInput, &streamFormat);

    assert(!error && "Failed to get input device sample format");

    UInt32 streamIsFloat = streamFormat.mFormatFlags & kAudioFormatFlagIsFloat;
    UInt32 sampleRate = streamFormat.mSampleRate;
    UInt32 bytesPerSample = streamFormat.mBytesPerFrame / streamFormat.mChannelsPerFrame;
    UInt32 channelCount = inputData->mBuffers[0].mNumberChannels;

    float *inputBuffer = (float *)inputData->mBuffers[0].mData;

    pThis->m_buffer->appendBinary(reinterpret_cast<const char *>(inputBuffer), frameCount * channelCount * sizeof(float));

    auto data = Data(pThis->m_buffer);
    pThis->next(data);

    return 0;
  }

private:
  static inline float m_micBuffer[BUFFER_SIZE];
  std::shared_ptr<FloatRingBuffer> m_buffer;
  AudioDeviceID m_inputDeviceID = 0;
  AudioDeviceIOProcID m_inputIOProcID = NULL;
  json m_state;
};