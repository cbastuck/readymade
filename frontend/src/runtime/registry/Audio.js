import soundDescriptor from '../services/Sound';
import mp3Encoder from '../services/MP3Encoder';

export default function () {
  return [
    soundDescriptor,
    mp3Encoder
  ];
}