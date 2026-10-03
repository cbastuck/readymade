#pragma once

#include <chrono>
#include <memory>
#include <string>
#include <vector>

#include <types/types.h>
#include <service.h>

#include "./mp3_frames.h"

/**
 * Service Documentation
 * Service ID: audio-encode
 * Service Name: Audio Encode
 * Runtime: hkp-rt
 * Modes: mp3 | wav — the format is configuration, not a mode
 * Key Config: format, bitrate, quality, sampleRate, channels, stream
 * IO: in=FloatRingBuffer (float32 samples, interleaved) -> out=the encoded bytes
 * Arrays: n/a
 * Binary: emits it; that is the whole service
 * MixedData: not used
 *
 * The same service as hkp-python's `audio-encode`, with the same state: it
 * turns samples into a file's worth of bytes, and emits the bytes bare, because
 * what they are called belongs to whatever keeps them.
 *
 * **`stream` is the one addition, and it changes what a pass means.** Without
 * it, each pass is a whole recording: the input is encoded and the encoder
 * flushed, so what comes out is a complete file. With it, the passes are one
 * recording that never ends. A single encoder lives across all of them; each
 * pass hands it whatever samples arrived since the last, and emits the frames
 * that finished — possibly none, in which case the pass stops here. Nothing is
 * flushed until the stream is reconfigured.
 *
 * That is what an MP3 stream needs, because frames are not independent: each
 * overlaps its neighbours, and may spend bits its predecessors saved. An
 * encoder keeps the samples its model still needs and holds back what it
 * cannot encode yet; restarting it per pass would put a seam, and the
 * encoder's start-up delay, into every chunk.
 *
 * Every chunk a stream emits is whole frames, so each is a place a listener
 * can start. `stream` is mp3 only.
 *
 * The sample rate and channel count are configuration: a FloatRingBuffer is a
 * generic float carrier, and the board says what its samples are.
 *
 * mp3 needs LAME, compiled in with HKP_MP3_ENABLED; wav is always available.
 */
namespace hkp {

class AudioEncode : public Service
{
public:
  static std::string serviceId() { return "audio-encode"; }

  explicit AudioEncode(const std::string& instanceId);
  ~AudioEncode();

  json configure(Data data) override;
  std::string getServiceId() const override { return serviceId(); }
  json getState() const override;
  Data process(Data data) override;

  // One encoder, alive across calls. Defined where LAME is.
  class Mp3Stream;

private:
  Data encodeOnce(FloatRingBuffer& input);
  Data encodeStream(FloatRingBuffer& input);
  Data fail(const std::string& message);
  void notifyThrottled();

  std::string m_format = "mp3";
  int m_bitrate = 64;
  int m_quality = 5;
  int m_sampleRate = 24000;
  int m_channels = 1;
  bool m_stream = false;

  std::size_t m_lastBytes = 0;
  double m_lastSeconds = 0.0;
  std::string m_error;

  // Stream mode. Rebuilt whenever what it encodes changes.
  std::unique_ptr<Mp3Stream> m_mp3;
  Mp3FrameSplitter m_frames;
  // Reused every pass: samples read out of the ring buffer, and the encoder's
  // output before it is cut into frames. Sized once, then only reused.
  std::vector<float> m_pcm;
  std::vector<uint8_t> m_encoded;
  std::size_t m_streamedBytes = 0;
  std::chrono::steady_clock::time_point m_lastNotified;
};

} // namespace hkp
