import soundDescriptor from '../services/Sound';
import mp3Encoder from '../services/MP3Encoder';
import audioRecorderDescriptor from '../services/AudioRecorder';

export default function () {
  return [
    soundDescriptor,
    mp3Encoder,
    audioRecorderDescriptor
  ];
}