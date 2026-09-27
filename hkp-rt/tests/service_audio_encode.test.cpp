#include <catch2/catch_test_macros.hpp>

#include <cmath>
#include <cstring>

#include <types/data.h>

#include "services/audio_encode.h"
#include "services/mp3_frames.h"

using namespace hkp;

namespace {

// A sine, interleaved across `channels`, continuing from `start`.
std::shared_ptr<FloatRingBuffer> sine(int frames, int channels, int sampleRate, int start = 0)
{
  auto buffer = std::make_shared<FloatRingBuffer>("sine");
  for (int i = 0; i < frames; ++i)
  {
    const float value = 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * (start + i) / sampleRate);
    for (int c = 0; c < channels; ++c)
    {
      buffer->append(value);
    }
  }
  return buffer;
}

// Walks `bytes` frame by frame; answers the number of frames, or -1 where
// something other than a whole frame is found.
int countWholeFrames(const BinaryData& bytes)
{
  std::size_t offset = 0;
  int frames = 0;
  while (offset < bytes.size())
  {
    auto header = parseMp3FrameHeader(bytes.data() + offset, bytes.size() - offset);
    if (!header || offset + header->length > bytes.size())
    {
      return -1;
    }
    offset += header->length;
    ++frames;
  }
  return frames;
}

// MPEG-1 Layer III, 128 kbps, 44.1 kHz, no padding: 417 bytes a frame.
BinaryData fakeFrame(uint8_t fill)
{
  BinaryData frame(417, fill);
  frame[0] = 0xFF;
  frame[1] = 0xFB;
  frame[2] = 0x90;
  frame[3] = 0x00;
  return frame;
}

} // namespace

// ──────────────────────────────────────────────────────────────────────────────
// Frames
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a Layer III header says how long its frame is", "[audio-encode][mp3]")
{
  const auto frame = fakeFrame(0);
  auto header = parseMp3FrameHeader(frame.data(), frame.size());
  REQUIRE(header);
  REQUIRE(header->length == 417);
  REQUIRE(header->sampleRate == 44100);
  REQUIRE(header->samplesPerFrame == 1152);

  const uint8_t notAFrame[] = {0x49, 0x44, 0x33, 0x04}; // "ID3"
  REQUIRE_FALSE(parseMp3FrameHeader(notAFrame, sizeof(notAFrame)));
}

TEST_CASE("the splitter hands out whole frames however the bytes arrive",
          "[audio-encode][mp3]")
{
  BinaryData stream;
  for (uint8_t i = 0; i < 3; ++i)
  {
    const auto frame = fakeFrame(i);
    stream.insert(stream.end(), frame.begin(), frame.end());
  }

  Mp3FrameSplitter splitter;
  BinaryData out;

  // Half a frame: nothing yet.
  REQUIRE(splitter.push(stream.data(), 200, out) == 0);
  REQUIRE(out.empty());

  // The rest of the first and most of the second.
  REQUIRE(splitter.push(stream.data() + 200, 500, out) == 1);
  REQUIRE(out.size() == 417);

  // The remainder.
  REQUIRE(splitter.push(stream.data() + 700, stream.size() - 700, out) == 2);
  REQUIRE(out == stream);
  REQUIRE(countWholeFrames(out) == 3);
}

// ──────────────────────────────────────────────────────────────────────────────
// One recording per pass
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("wav is a 16-bit PCM file of what came in", "[audio-encode][wav]")
{
  AudioEncode encode("enc");
  encode.configure(Data(json{{"format", "wav"}, {"sampleRate", 16000}, {"channels", 1}}));

  auto out = encode.process(Data(sine(1600, 1, 16000)));
  auto bytes = getBinaryFromData(out);
  REQUIRE(bytes);
  REQUIRE(bytes->size() == 44 + 1600 * 2);
  REQUIRE(std::memcmp(bytes->data(), "RIFF", 4) == 0);
  REQUIRE(std::memcmp(bytes->data() + 8, "WAVE", 4) == 0);

  const auto state = encode.getState();
  REQUIRE(state["lastBytes"] == 44 + 1600 * 2);
  REQUIRE(state["lastSeconds"] == 0.1);
}

TEST_CASE("anything but samples is refused with a reason", "[audio-encode]")
{
  AudioEncode encode("enc");
  auto out = encode.process(Data(json{{"not", "audio"}}));
  REQUIRE(getJSONFromData(out)->contains("error"));
  REQUIRE_FALSE(encode.getState()["error"].get<std::string>().empty());
}

TEST_CASE("a stream is mp3 only", "[audio-encode][stream]")
{
  AudioEncode encode("enc");
  encode.configure(Data(json{{"format", "wav"}, {"stream", true}}));
  auto out = encode.process(Data(sine(480, 1, 48000)));
  REQUIRE(getJSONFromData(out)->contains("error"));
}

#if HKP_MP3_ENABLED

TEST_CASE("mp3 is a complete file per pass", "[audio-encode][mp3]")
{
  AudioEncode encode("enc");
  encode.configure(Data(json{{"format", "mp3"}, {"sampleRate", 48000}, {"channels", 1}, {"bitrate", 64}}));

  auto out = encode.process(Data(sine(48000, 1, 48000)));
  auto bytes = getBinaryFromData(out);
  REQUIRE(bytes);
  // Flushed, so every sample is in there: at least a second's worth of frames.
  const int frames = countWholeFrames(*bytes);
  REQUIRE(frames >= 48000 / 1152);
}

TEST_CASE("a stream is one encoder across passes, emitting whole frames",
          "[audio-encode][mp3][stream]")
{
  AudioEncode encode("enc");
  encode.configure(Data(json{
    {"format", "mp3"}, {"stream", true}, {"sampleRate", 48000}, {"channels", 2}, {"bitrate", 128}}));

  // The same buffer every pass, the way core-input hands it on: each pass
  // reads what arrived since the last.
  auto buffer = std::make_shared<FloatRingBuffer>("mic");
  const int block = 512;
  int written = 0;
  int passesWithOutput = 0;
  int frames = 0;
  BinaryData all;

  for (int pass = 0; pass < 200; ++pass)
  {
    auto fresh = sine(block, 2, 48000, written);
    buffer->appendAvailable(*fresh, true);
    written += block;

    auto out = encode.process(Data(buffer));
    REQUIRE(buffer->availableCount() == 0);
    if (isNull(out))
    {
      continue; // the encoder is still holding what it needs
    }
    auto bytes = getBinaryFromData(out);
    REQUIRE(bytes);
    const int whole = countWholeFrames(*bytes);
    REQUIRE(whole > 0); // every chunk starts and ends on a frame
    frames += whole;
    ++passesWithOutput;
    all.insert(all.end(), bytes->begin(), bytes->end());
  }

  // Never flushed, so only the encoder's delay short of what went in — not a
  // start-up delay per pass.
  const int expectedFrames = written / 1152;
  REQUIRE(frames >= expectedFrames - 3);
  REQUIRE(frames <= expectedFrames);
  REQUIRE(passesWithOutput > 50);
  REQUIRE(countWholeFrames(all) == frames);
  REQUIRE(encode.getState()["streamedBytes"] == all.size());
}

TEST_CASE("changing a setting starts a new stream", "[audio-encode][mp3][stream]")
{
  AudioEncode encode("enc");
  encode.configure(Data(json{{"stream", true}, {"sampleRate", 48000}, {"channels", 1}}));
  encode.process(Data(sine(48000, 1, 48000)));
  REQUIRE(encode.getState()["streamedBytes"].get<std::size_t>() > 0);

  encode.configure(Data(json{{"bitrate", 96}}));
  encode.process(Data(sine(256, 1, 48000)));
  // A new encoder, holding its first samples: nothing streamed yet.
  REQUIRE(encode.getState()["streamedBytes"] == 0);
}

#endif
