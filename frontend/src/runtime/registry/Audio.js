import soundDescriptor from '../services/audio/Sound';
import mp3Encoder from '../services/audio/MP3Encoder';
import audioRecorderDescriptor from '../services/audio/AudioRecorder';
import audioInputDescriptor from '../services/audio/AudioInput';
import audioOutputDescriptor from '../services/audio/AudioOutput';
import midiInputDescriptor from '../services/audio/MidiInput';

export default function audioRegistry() {
  return [
    audioInputDescriptor,
    audioOutputDescriptor,
    soundDescriptor,
    midiInputDescriptor,
    mp3Encoder,
    audioRecorderDescriptor
  ];
}