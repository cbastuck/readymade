#pragma once

#include <atomic>
#include <iostream>
#include <memory>
#include <string>
#include <CoreAudio/CoreAudio.h>

#include <types/types.h>
#include <service.h>

#include "./core_audio.h"
#include "../common/realtime_wakeup.h"
#include "../runtime_host.h"

/**
 * Service Documentation
 * Service ID: core-input
 * Service Name: CoreInput
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 *
 * **Which thread the services after this one run on.** The device calls back
 * on its realtime audio thread, and the samples go into a ring buffer there.
 * With `deferPropagation` off, the rest of the pipeline also runs right there,
 * inside the callback — the lowest latency, and only sound when everything
 * after this service is realtime-safe. With it on, the callback only signals,
 * and the rest of the pipeline runs on the runtime's event loop; the buffer
 * carries the samples across, so a pass that starts late reads everything that
 * arrived in between. Nothing on the audio thread allocates, locks or logs
 * either way — the callback appends and signals, and that is all.
 */
namespace hkp {

class CoreInput : public Service
{
public:
  static std::string serviceId() { return "core-input"; }

  CoreInput(const std::string& instanceId) 
    : Service(instanceId, serviceId())
    , m_buffer(std::make_shared<FloatRingBuffer>(instanceId))
  {
    m_bypass = true; // Start in bypass mode
  }

  ~CoreInput()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      bool deferPropagation = m_deferPropagation.load();
      if (updateIfNeeded(deferPropagation, (*buf)["deferPropagation"]))
      {
        m_deferPropagation.store(deferPropagation);
      }
      updateIfNeeded(m_preferredInputDeviceName, (*buf)["preferredInputDeviceName"]);
      updateIfNeeded(m_preferredSampleRate, (*buf)["preferredSampleRate"]);
      updateIfNeeded(m_preferredBufferSize, (*buf)["preferredBufferSize"]);
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
    state["deferPropagation"] = m_deferPropagation.load();
    state["currentDeviceName"] = CoreAudioGetInputDeviceName(m_inputDeviceID);
    state["availableDevices"] = CoreAudioEnumerateAvailableDevices();
    state["preferredInputDeviceName"] = m_preferredInputDeviceName;
    state["sampleRate"] = m_sampleRate;
    state["bufferSize"] = m_bufferSize;
    // Samples in the buffer are interleaved across this many channels, which a
    // service reading them (an encoder, say) is configured to match.
    state["channels"] = m_channels;
    state["availableSampleRates"] = m_inputDeviceID ? CoreAudioGetAvailableSampleRates(m_inputDeviceID) : json::array();
    state["error"] = m_error;
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
    
    status = m_preferredInputDeviceName.empty() ? CoreAudioGetDefaultInputDevice(&m_inputDeviceID) : CoreAudioGetInputDeviceByName(&m_inputDeviceID, m_preferredInputDeviceName);
    if (status != 0)
    {
      std::cerr << "Failed to get default input device" << std::endl;
      return;
    }

    std::string deviceName = CoreAudioGetInputDeviceName(m_inputDeviceID);
    std::cout << "Using input device: " << deviceName << std::endl;
  
    m_error.clear();
    if (m_preferredSampleRate > 0)
    {
      status = CoreAudioSetSampleRate(m_inputDeviceID, m_preferredSampleRate);
      if (status != 0)
        std::cerr << "CoreInput::start(): Failed to set sample rate to " << m_preferredSampleRate << std::endl;
    }
    double sampleRate = 0;
    CoreAudioGetSampleRate(m_inputDeviceID, &sampleRate);
    m_sampleRate = sampleRate;

    // Read once here rather than on every callback: asking the HAL for a
    // property from the audio thread can block.
    AudioStreamBasicDescription streamFormat = {0};
    status = CoreAudioGetSampleFormat(m_inputDeviceID, kAudioObjectPropertyScopeInput, &streamFormat);
    if (status != 0 || !(streamFormat.mFormatFlags & kAudioFormatFlagIsFloat))
    {
      reportError("the input device does not deliver float samples");
      return;
    }
    // The callback reads one buffer holding every channel. A device that hands
    // each channel its own buffer would be captured as its first channel only,
    // under a channel count that says otherwise.
    if (streamFormat.mChannelsPerFrame > 1 && (streamFormat.mFormatFlags & kAudioFormatFlagIsNonInterleaved))
    {
      reportError("the input device delivers its channels in separate buffers, which is not supported");
      return;
    }
    m_channels = streamFormat.mChannelsPerFrame;

    // Capture goes ahead at the rate the device has: the samples are good, and
    // only what reads them under the rate that was asked for is wrong. Compared
    // against the rate read back, since a device can accept the request and
    // keep its own.
    if (m_preferredSampleRate > 0 && m_sampleRate != m_preferredSampleRate)
    {
      reportError("the input device runs at " + std::to_string(static_cast<long>(m_sampleRate)) +
                  " Hz, not the " + std::to_string(static_cast<long>(m_preferredSampleRate)) +
                  " Hz asked for");
    }

    UInt32 targetBufferSize = m_preferredBufferSize > 0 ? m_preferredBufferSize : BUFFER_SIZE;
    status = CoreAudioSetBufferSize(m_inputDeviceID, targetBufferSize);
    if (status != 0)
    {
      std::cerr << "Failed to set input device buffer size" << std::endl;
      return;
    }
    m_bufferSize = targetBufferSize;

    // Before the device starts, so the callback never sees it missing; torn
    // down in stop() only after the device has stopped calling back.
    m_handoff = std::make_shared<Handoff>(*this);
    m_handoff->self = m_handoff;

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

    auto inputIOProcID  = m_inputIOProcID;
    m_inputIOProcID = NULL;
    OSStatus status = AudioDeviceStop(m_inputDeviceID, inputIOProcID);
    if (status != 0)
    {
      std::cerr << "Failed to stop input device" << std::endl;
      return;
    }

    status = AudioDeviceDestroyIOProcID(m_inputDeviceID, inputIOProcID);
    if (status != 0)
    {
      std::cerr << "Failed to destroy input device IO proc" << std::endl;
      return;
    }

    // The device no longer calls back, so nothing signals any more. A pass
    // already posted finds the handoff gone and does nothing.
    m_handoff.reset();
  }

  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      std::cout << "Calling stop() in CoreInput::onBypassChanged" << std::endl;
      stop();
      std::cout << "Called stop() in CoreInput::onBypassChanged" << std::endl;
    }
    else
    {
      std::cout << "Calling start() in CoreInput::onBypassChanged" << std::endl;
      start(); 
      std::cout << "Called start() in CoreInput::onBypassChanged" << std::endl;
    }
    return bypass;
  }

  // Runs on the device's realtime thread: append, then either run the rest of
  // the pipeline in place or signal the handoff. Nothing here allocates, locks
  // or logs.
  static OSStatus onAudioInput(AudioDeviceID device,
                               const AudioTimeStamp *now,
                               const AudioBufferList *inputData,
                               const AudioTimeStamp *inputTime,
                               AudioBufferList *outputData,
                               const AudioTimeStamp *outputTime,
                               void *userData)
  {
    CoreInput *pThis = static_cast<CoreInput *>(userData);

    // What the device delivered, whatever size it chose this time: the byte
    // count covers every channel of every frame in the (interleaved) buffer.
    const AudioBuffer& buffer = inputData->mBuffers[0];
    pThis->m_buffer->appendBinary(static_cast<const char *>(buffer.mData), buffer.mDataByteSize);

    if (pThis->m_deferPropagation.load(std::memory_order_relaxed))
    {
      if (Handoff* handoff = pThis->m_handoff.get())
      {
        handoff->wakeup.signal();
      }
      return 0;
    }

    pThis->next(Data(pThis->m_buffer), true);
    return 0;
  }

  void propagate()
  {
    next(Data(m_buffer), true);
  }

  // Kept in state and notified, so a board can show it. Never called from the
  // audio thread.
  void reportError(const std::string& message)
  {
    m_error = message;
    std::cerr << "CoreInput: " << message << std::endl;
    sendNotification(json{{"error", m_error}});
  }

  // Carries a deferred pass from the audio thread to the runtime's event loop.
  //
  // The wakeup's own thread does the posting, because posting may allocate.
  // The posted pass holds this object rather than the service, and finds it
  // gone once stop() has run — so a pass queued behind a stop does nothing.
  struct Handoff
  {
    explicit Handoff(CoreInput& owner)
      : owner(owner)
      , wakeup([this]() { onWake(); })
    {
    }

    void onWake()
    {
      auto* host = owner.parentHost();
      if (!host)
      {
        wakeup.acknowledge();
        return;
      }
      host->post([weak = self]() {
        if (auto handoff = weak.lock())
        {
          // Before reading, so samples arriving during this pass wake another.
          handoff->wakeup.acknowledge();
          handoff->owner.propagate();
        }
      });
    }

    CoreInput& owner;
    std::weak_ptr<Handoff> self;
    // Last: its thread starts in the constructor and uses the members above.
    RealtimeWakeup wakeup;
  };

private:
  std::shared_ptr<FloatRingBuffer> m_buffer;
  std::shared_ptr<Handoff> m_handoff;
  AudioDeviceID m_inputDeviceID = 0;
  AudioDeviceIOProcID m_inputIOProcID = NULL;
  std::string m_preferredInputDeviceName;
  // Read on the audio thread, written by configure().
  std::atomic<bool> m_deferPropagation{false};
  double m_sampleRate = 0.0;
  UInt32 m_bufferSize = 0;
  UInt32 m_channels = 0;
  double m_preferredSampleRate = 0.0;
  UInt32 m_preferredBufferSize = 0;
  std::string m_error;
};

}
