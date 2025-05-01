
#include <cstdint>
#include <cmath>
#include <cassert>
#include <string>
#include <cstring>
#include <array>
#include <iostream>
#include <map>
#include "./pro54.h"

void setPatch(Pro54& p)
{
  std::map<std::string, float> patch = {
    {"ActiveVoices", 5},
    {"PolyModFilterEnv", 37.7953},
    {"PolyModOscB", 50.3937},
    {"PolyModFreqA", 1},
    {"PolyModPWA", 0},
    {"PolyModFilt", 0},
    {"OscAFreq", 63.7795},
    {"OscASaw", 1},
    {"OscAPulse", 0},
    {"OscAPW", 19.685},
    {"OscASync", 1},
    {"MixerOscALevel", 61.4173},
    {"MixerOscBLevel", 100},
    {"MixerNoiseLevel", 0},
    {"ExternalInputLevel", 0},
    {"FilterCutoff", 29.9213},
    {"FilterResonance", 29.1339},
    {"FilterEnvAmt", 37.0079},
    {"FilterKeyboardTracking", 100},
    {"FilterAttack", 0},
    {"FilterDecay", 68.5039},
    {"FilterSustain", 0},
    {"FilterRelease", 65.3543},
    {"DelayTime", 68.5039},
    {"DelaySpread", 41.7323},
    {"DelayDepth", 0},
    {"DelayRate", 0},
    {"DelayFeedback", 26.7717},
    {"DelayHiCut", 30.7087},
    {"DelayLoCut", 70.0787},
    {"DelayINV", 0},
    {"DelayON", 1},
    {"DelayWet", 20.4724},
    {"DelaySync", 0},
    {"DelayMidi", 0},
    {"LfoMidiSync", 0},
    {"LfoFrequency", 73.2283},
    {"LfoShapeSaw", 0},
    {"LfoShapeTri", 0},
    {"LfoShapePulse", 1},
    {"OscBFreq", 25.1968},
    {"OscBFreqFine", 0},
    {"OscBShapeSaw", 0},
    {"OscBShapeTri", 1},
    {"OscBShapePulse", 0},
    {"OscBPWAmount", 11.0236},
    {"OscBSubOsc", 0},
    {"OscBKKeyboardTracking", 1},
    {"WheelModulationLfoNoise", 0},
    {"WheelModulationFreqOscA", 1},
    {"WheelModulationFreqOscB", 0},
    {"WheelModulationPWA", 0},
    {"WheelModulationPWB", 0},
    {"WheelModulationFilter", 0},
    {"Glide", 0},
    {"Unison", 0},
    {"AmplifierAttack", 0},
    {"AmplifierDecay", 61.4173},
    {"AmplifierSustain", 71.6535},
    {"AmplifierRelease", 37.7953},
    {"Release", 1},
    {"Velocity", 1},
    {"Analog", 33.0709},
    {"ModWheel", 0},
    {"FilterHPF", 0},
    {"FilterInvertEnv", 0},
    {"Repeat", 0}
  };
  for (auto& [key, value] : patch)
  {
    auto ep = Pro54::inputEndpoints[Pro54::getEndpointHandleForName(key)];
    p.addEvent(ep.handle, (unsigned int)ep.endpointType, (unsigned char*)&value);
  }  
}

// (112, { PatchName: "PWM Sweep", ActiveVoices: 5, PolyModFilterEnv: 0, PolyModOscB: 18.8976, PolyModFreqA: 0, PolyModPWA: 1, PolyModFilt: 0, OscAFreq: 24.4094, OscASaw: 0, OscAPulse: 1, OscAPW: 45.6693, OscASync: 0, MixerOscALevel: 55.9055, MixerOscBLevel: 58.2677, MixerNoiseLevel: 0, ExternalInputLevel: 0, FilterCutoff: 16.5354, FilterResonance: 69.2913, FilterEnvAmt: 79.5276, FilterKeyboardTracking: 100, FilterAttack: 81.8898, FilterDecay: 83.4646, FilterSustain: 41.7323, FilterRelease: 87.4016, DelayTime: 76.378, DelaySpread: 80.315, DelayDepth: 22.0472, DelayRate: 24.4094, DelayFeedback: 51.9685, DelayHiCut: 0, DelayLoCut: 100, DelayINV: 1, DelayON: 1, DelayWet: 41.7323, DelaySync: 0, DelayMidi: 0, LfoMidiSync: 0, LfoFrequency: 70.0787, LfoShapeSaw: 0, LfoShapeTri: 1, LfoShapePulse: 0, OscBFreq: 51.9685, OscBFreqFine: 0, OscBShapeSaw: 0, OscBShapeTri: 1, OscBShapePulse: 0, OscBPWAmount: 49.6063, OscBSubOsc: 1, OscBKKeyboardTracking: 1, WheelModulationLfoNoise: 0, WheelModulationFreqOscA: 0, WheelModulationFreqOscB: 0, WheelModulationPWA: 1, WheelModulationPWB: 1, WheelModulationFilter: 0, Glide: 62.9921, Unison: 0, AmplifierAttack: 56.6929, AmplifierDecay: 73.2283, AmplifierSustain: 100, AmplifierRelease: 72.4409, Release: 1, Velocity: 1, Analog: 33.0709, ModWheel: 0, FilterHPF: 0, FilterInvertEnv: 0, Repeat: 0 });

int main()
{
  Pro54 pro54;
  pro54.initialise(1, 44100);
  pro54.addEvent_Volume(0.5);

  if (true) 
  {
      Pro54::std_notes_NoteOn n;
      n.channel = 0;
      n.pitch = 60;
      n.velocity = 127;
      pro54.addEvent_eventIn(n);
  } else {
    pro54.addEvent_TestTone(1);
  }

  setPatch(pro54);
  for (int i = 0; i < 1000; i++) 
  {
    pro54.advance(512);
    
    for (int j = 0; j < 512; j++) 
    {
      std::cout << pro54.io.out[j][0] << " ";
    }
    
  }
  return 0;
}

