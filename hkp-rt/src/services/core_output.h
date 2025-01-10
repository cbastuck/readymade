#pragma once

#include <iostream>
#include <CoreAudio/CoreAudio.h>

#include "./core_audio.h"
#include <service.h>
#include <types/types.h>

class CoreOutput : public Service
{
public:
  CoreOutput(std::string instanceId)
      : Service(instanceId)
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
    return "core-output";
  }

  json getState() const override
  {
    return m_state;
  }

private:
  void start()
  {
    CoreAudioGetDefaultOutputDevice(&m_outputDeviceID);

    UInt32 bufferSize = 0;
    CoreAudioGetBufferSize(m_outputDeviceID, &bufferSize);

    bufferSize = BUFFER_SIZE;
    CoreAudioSetBufferSize(m_outputDeviceID, bufferSize);

    AudioDeviceCreateIOProcID(m_outputDeviceID, CoreOutput::onAudioOutput, this, &m_outputIOProcID);

    AudioDeviceStart(m_outputDeviceID, m_outputIOProcID);
  }

  void stop()
  {
    AudioDeviceStop(m_outputDeviceID, m_outputIOProcID);
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

    assert(!Error && "Failed to get output device sample format");

    UInt32 streamIsFloat = StreamFormat.mFormatFlags & kAudioFormatFlagIsFloat;
    UInt32 sampleRate = StreamFormat.mSampleRate;
    UInt32 bytesPerSample = StreamFormat.mBytesPerFrame / StreamFormat.mChannelsPerFrame;
    UInt32 channelCount = outputData->mBuffers[0].mNumberChannels;

    if (!streamIsFloat || bytesPerSample != 4)
    {
      // TODO(robin): Does CoreAudio ever deal with anything that isn't 32 bit float?
      printf("\n*** Unsupported stream format! (%d bit %s) ***\n\n",
             bytesPerSample * 8, streamIsFloat ? "float" : "int");
      assert(0);
    }

    float *outputBuffer = (float *)outputData->mBuffers[0].mData;
    UInt32 frameCount = 0;
    CoreAudioGetBufferSize(device, &frameCount);

    if (pThis->isConnected())
    {
      Data data = pThis->next();
      auto buffer = getRingBufferFromData(data);
      if (buffer)
      {
        buffer->consumeBinary(outputBuffer, frameCount, channelCount);
      }
    }

    return 0;
  }

private:
  AudioDeviceID m_outputDeviceID = 0;
  AudioDeviceIOProcID m_outputIOProcID = NULL;
  json m_state;
};