#pragma once

#include <iostream>
#include <CoreAudio/CoreAudio.h>

#include <types/types.h>
#include <service.h>

#include "./core_audio.h"

class CoreInput : public Service
{
public:
  CoreInput(std::string instanceId) : Service(instanceId),
                                      m_buffer(std::make_shared<FloatRingBuffer>(instanceId)),
                                      m_state({{"running", false}}) 
  {
  }

  ~CoreInput()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf.is_null())
    {
      return false;
    }

    if (updateIfNeeded(m_state["running"], buf["running"]))
    {
      m_state["running"] == true ? start() : stop();      
    }

    return getState();
  }

  std::string getServiceId() const override
  {
    return "core-input";
  }

  json getState() const override
  {
    return m_state;
  }

private:
  void start()
  {
    CoreAudioGetDefaultInputDevice(&m_inputDeviceID);

    UInt32 bufferSize = 0;
    CoreAudioGetBufferSize(m_inputDeviceID, &bufferSize);

    bufferSize = BUFFER_SIZE;
    CoreAudioSetBufferSize(m_inputDeviceID, bufferSize);

    AudioDeviceCreateIOProcID(m_inputDeviceID, onAudioInput, this, &m_inputIOProcID);

    AudioDeviceStart(m_inputDeviceID, m_inputIOProcID);
  }

  void stop()
  {
    AudioDeviceStop(m_inputDeviceID, m_inputIOProcID);
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