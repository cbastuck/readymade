#pragma once

#include <CoreAudio/CoreAudio.h>

OSStatus CoreAudioGetBufferSize(AudioDeviceID Device, UInt32 *BufferSize);
OSStatus CoreAudioSetBufferSize(AudioDeviceID Device, UInt32 BufferSize);
OSStatus CoreAudioGetSampleRate(AudioDeviceID Device, double *SampleRate);
OSStatus CoreAudioGetSampleFormat(AudioDeviceID Device,
                                  AudioObjectPropertyScope Scope,
                                  AudioStreamBasicDescription *Format);
OSStatus CoreAudioGetDefaultOutputDevice(AudioDeviceID *Device);
OSStatus CoreAudioGetDefaultInputDevice(AudioDeviceID *Device);
