#pragma once

#include <CoreAudio/CoreAudio.h>
#include <nlohmann/json.hpp>

OSStatus CoreAudioGetBufferSize(AudioDeviceID Device, UInt32 *BufferSize);
OSStatus CoreAudioSetBufferSize(AudioDeviceID Device, UInt32 BufferSize);
OSStatus CoreAudioGetSampleRate(AudioDeviceID Device, double *SampleRate);
OSStatus CoreAudioGetSampleFormat(AudioDeviceID Device,
                                  AudioObjectPropertyScope Scope,
                                  AudioStreamBasicDescription *Format);
OSStatus CoreAudioGetDefaultOutputDevice(AudioDeviceID *Device);
OSStatus CoreAudioGetDefaultInputDevice(AudioDeviceID *Device);
OSStatus CoreAudioGetInputDeviceByName(AudioDeviceID *Device, const std::string &preferredDeviceName);

bool CoreAudioDeviceHasStream(AudioDeviceID deviceID, AudioObjectPropertyScope scope);
nlohmann::json CoreAudioEnumerateAvailableDevices();
std::string CoreAudioGetInputDeviceName(AudioDeviceID inputDeviceID);
std::string CoreAudioGetOutputDeviceName(AudioDeviceID outputDeviceID);