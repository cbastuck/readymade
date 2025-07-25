#include "./core_audio.h"

#include <vector>
#include <iostream>
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

OSStatus CoreAudioGetInputDeviceByName(AudioDeviceID *Device, const std::string &preferredDeviceName)
{
  UInt32 dataSize = 0;
  AudioObjectPropertyAddress propertyAddress = {
      kAudioHardwarePropertyDevices,
      kAudioObjectPropertyScopeGlobal,
      kAudioObjectPropertyElementMain
  };

  // Get the size of the device list
  OSStatus status = AudioObjectGetPropertyDataSize(kAudioObjectSystemObject, &propertyAddress, 0, NULL, &dataSize);
  if (status != 0 || dataSize == 0)
  {
    std::cerr << "Failed to get audio device list size" << std::endl;
    return status;
  }

  UInt32 deviceCount = dataSize / sizeof(AudioDeviceID);
  std::vector<AudioDeviceID> deviceIDs(deviceCount);

  // Get the device IDs
  status = AudioObjectGetPropertyData(kAudioObjectSystemObject, &propertyAddress, 0, NULL, &dataSize, deviceIDs.data());
  if (status != 0)
  {
    std::cerr << "Failed to get audio device IDs" << std::endl;
    return status;
  }

  // Iterate through devices to find the preferred device
  for (UInt32 i = 0; i < deviceCount; ++i)
  {
    AudioDeviceID deviceID = deviceIDs[i];
    AudioObjectPropertyAddress nameAddress = {
        kAudioDevicePropertyDeviceNameCFString,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };

    CFStringRef deviceNameRef = NULL;
    UInt32 nameSize = sizeof(deviceNameRef);
    status = AudioObjectGetPropertyData(deviceID, &nameAddress, 0, NULL, &nameSize, &deviceNameRef);
    if (status == 0 && deviceNameRef)
    {
      char deviceName[256];
      CFStringGetCString(deviceNameRef, deviceName, sizeof(deviceName), kCFStringEncodingUTF8);
      CFRelease(deviceNameRef);

      if (preferredDeviceName == deviceName)
      {
        *Device = deviceID;
        return noErr;
      }
    }
  }

  std::cerr << "Preferred input device not found: " << preferredDeviceName << std::endl;
  return kAudioHardwareUnspecifiedError;
}

// Returns true if the device has a stream for the given scope (input/output)
bool CoreAudioDeviceHasStream(AudioDeviceID deviceID, AudioObjectPropertyScope scope)
{
  UInt32 propertySize = 0;
  AudioObjectPropertyAddress propertyAddress = {
    kAudioDevicePropertyStreams,
    scope,
    kAudioObjectPropertyElementMain
  };
  OSStatus status = AudioObjectGetPropertyDataSize(deviceID, &propertyAddress, 0, nullptr, &propertySize);
  return (status == 0 && propertySize > 0);
}

nlohmann::json CoreAudioEnumerateAvailableDevices()
  {
    UInt32 dataSize = 0;
    AudioObjectPropertyAddress propertyAddress = {
      kAudioHardwarePropertyDevices,
      kAudioObjectPropertyScopeGlobal,
      kAudioObjectPropertyElementMain
    };

    auto devices = nlohmann::json::array();
    // Get the size of the device list
    OSStatus status = AudioObjectGetPropertyDataSize(kAudioObjectSystemObject, &propertyAddress, 0, NULL, &dataSize);
    if (status != 0 || dataSize == 0)
    {
      std::cerr << "Failed to get audio device list size" << std::endl;
      return nullptr;
    }

    UInt32 deviceCount = dataSize / sizeof(AudioDeviceID);
    std::vector<AudioDeviceID> deviceIDs(deviceCount);

    // Get the device IDs
    status = AudioObjectGetPropertyData(kAudioObjectSystemObject, &propertyAddress, 0, NULL, &dataSize, deviceIDs.data());
    if (status != 0)
    {
      std::cerr << "Failed to get audio device IDs" << std::endl;
      return nullptr;
    }

    // For each device, get its name
    for (UInt32 i = 0; i < deviceCount; ++i)
    {
      AudioDeviceID deviceID = deviceIDs[i];
      AudioObjectPropertyAddress nameAddress = {
        kAudioDevicePropertyDeviceNameCFString,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
      };
      CFStringRef deviceNameRef = NULL;
      UInt32 nameSize = sizeof(deviceNameRef);
      status = AudioObjectGetPropertyData(deviceID, &nameAddress, 0, NULL, &nameSize, &deviceNameRef);
      auto isInput = CoreAudioDeviceHasStream(deviceID, kAudioDevicePropertyScopeInput);
      auto isOutput = CoreAudioDeviceHasStream(deviceID, kAudioDevicePropertyScopeOutput);
      auto type = isInput ? "input" : (isOutput ? "output" : "unknown");
      if (status == 0 && deviceNameRef)
      {
        char deviceName[256];
        CFStringGetCString(deviceNameRef, deviceName, sizeof(deviceName), kCFStringEncodingUTF8);
        devices.push_back({
          { "deviceName", deviceName},
          { "deviceID", static_cast<int>(deviceID) }, 
          { "type", type },
        });
        CFRelease(deviceNameRef);
      }
    }

    return devices;
  }

  std::string CoreAudioGetInputDeviceName(AudioDeviceID inputDeviceID)
  {
    AudioObjectPropertyAddress propertyAddress = {
      kAudioDevicePropertyDeviceNameCFString,
      kAudioObjectPropertyScopeInput,
      kAudioObjectPropertyElementMain
    };

    CFStringRef deviceNameRef = NULL;
    UInt32 size = sizeof(deviceNameRef);
    
    if (inputDeviceID == 0)
    {
      return "";
    }
  
    OSStatus status = AudioObjectGetPropertyData(inputDeviceID, &propertyAddress, 0, NULL, &size, &deviceNameRef);
    if (status != 0 || deviceNameRef == NULL)
    {
      std::cerr << "Failed to get input device name" << std::endl;
      return "Unknown Device";
    }

    char deviceName[256];
    CFStringGetCString(deviceNameRef, deviceName, sizeof(deviceName), kCFStringEncodingUTF8);
    CFRelease(deviceNameRef);

    return std::string(deviceName);
  }

  std::string CoreAudioGetOutputDeviceName(AudioDeviceID outputDeviceID)
  {
     AudioObjectPropertyAddress propertyAddress = {
      kAudioDevicePropertyDeviceNameCFString,
      kAudioObjectPropertyScopeOutput,
      kAudioObjectPropertyElementMain
    };

    CFStringRef deviceNameRef = NULL;
    UInt32 size = sizeof(deviceNameRef);
    OSStatus status = AudioObjectGetPropertyData(outputDeviceID, &propertyAddress, 0, NULL, &size, &deviceNameRef);
    
    if (status != 0 || deviceNameRef == NULL)
    {
      std::cerr << "Failed to get input device name" << std::endl;
      return "Unknown Device";
    }

    char deviceName[256];
    CFStringGetCString(deviceNameRef, deviceName, sizeof(deviceName), kCFStringEncodingUTF8);
    CFRelease(deviceNameRef);

    return std::string(deviceName);
  }