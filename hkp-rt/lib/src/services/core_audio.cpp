#include "./core_audio.h"

// NOTE(robin): The CoreAudio API for querying device data is absolutely insane
// so we provide some wrapper functions here, you can mostly ignore the implementation.
// The idea is that we define a selector, e.g. kAudioDevicePropertyBufferFrameSize, which
// we then pass to AudioObjectGetPropertyData which will write the data of the selected
// property at the pointer we provide.

OSStatus CoreAudioGetBufferSize(AudioDeviceID Device, UInt32 *BufferSize)
{
  AudioObjectPropertyAddress Property = {
      kAudioDevicePropertyBufferFrameSize, // NOTE(robin): This is the thing you care about
      kAudioObjectPropertyScopeGlobal,
      kAudioObjectPropertyElementMain,
  };

  UInt32 PropertySize = sizeof(*BufferSize);
  OSStatus Result = AudioObjectGetPropertyData(Device,
                                               &Property, 0, 0, &PropertySize, BufferSize);
  return Result;
}

OSStatus CoreAudioSetBufferSize(AudioDeviceID Device, UInt32 BufferSize)
{
  AudioObjectPropertyAddress Property = {
      kAudioDevicePropertyBufferFrameSize,
      kAudioObjectPropertyScopeGlobal,
      kAudioObjectPropertyElementMain,
  };

  UInt32 PropertySize = sizeof(BufferSize);
  OSStatus Result = AudioObjectSetPropertyData(Device,
                                               &Property, 0, 0, PropertySize, &BufferSize);
  return Result;
}

OSStatus CoreAudioGetSampleRate(AudioDeviceID Device, double *SampleRate)
{
  AudioObjectPropertyAddress Property =
      {
          kAudioDevicePropertyNominalSampleRate,

          kAudioObjectPropertyScopeGlobal,
          kAudioObjectPropertyElementMain,
      };

  UInt32 PropertySize = sizeof(*SampleRate);
  OSStatus Result = AudioObjectGetPropertyData(Device,
                                               &Property, 0, 0, &PropertySize, SampleRate);
  return Result;
}

// NOTE(robin): Scope is either kAudioObjectPropertyScopeInput (for an input device) or
// kAudioObjectPropertyScopeOutput (for an output device).
OSStatus CoreAudioGetSampleFormat(AudioDeviceID Device,
                                  AudioObjectPropertyScope Scope,
                                  AudioStreamBasicDescription *Format)
{
  AudioObjectPropertyAddress Property =
      {
          kAudioStreamPropertyVirtualFormat,

          Scope,
          kAudioObjectPropertyElementMain,
      };

  UInt32 PropertySize = sizeof(*Format);
  OSStatus Result = AudioObjectGetPropertyData(Device,
                                               &Property, 0, 0, &PropertySize, Format);
  return Result;
}

OSStatus CoreAudioGetDefaultOutputDevice(AudioDeviceID *Device)
{
  AudioObjectPropertyAddress Property =
      {
          kAudioHardwarePropertyDefaultOutputDevice,

          kAudioObjectPropertyScopeGlobal,
          kAudioObjectPropertyElementMain,
      };

  UInt32 PropertySize = sizeof(*Device);
  OSStatus Result = AudioObjectGetPropertyData(kAudioObjectSystemObject,
                                               &Property, 0, 0, &PropertySize, Device);
  return Result;
}

OSStatus CoreAudioGetDefaultInputDevice(AudioDeviceID *Device)
{
  AudioObjectPropertyAddress Property =
      {
          kAudioHardwarePropertyDefaultInputDevice,

          kAudioObjectPropertyScopeGlobal,
          kAudioObjectPropertyElementMain,
      };

  UInt32 PropertySize = sizeof(*Device);
  OSStatus Result = AudioObjectGetPropertyData(kAudioObjectSystemObject,
                                               &Property, 0, 0, &PropertySize, Device);
  return Result;
}
