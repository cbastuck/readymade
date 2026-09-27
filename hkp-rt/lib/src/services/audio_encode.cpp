#include "./audio_encode.h"

#include <algorithm>
#include <cmath>
#include <cstring>

#if HKP_MP3_ENABLED
#include <lame/lame.h>
#endif

namespace hkp {

namespace {

constexpr const char* kNotCompiled =
  "mp3 is not compiled into this runtime (built without HKP_MP3_ENABLED) — wav is";

// The largest output LAME can produce for `frames` samples per channel, as its
// documentation states it.
std::size_t mp3BufferBound(int frames)
{
  return static_cast<std::size_t>(1.25 * frames) + 7200;
}

void putLE(BinaryData& out, uint32_t value, int bytes)
{
  for (int i = 0; i < bytes; ++i)
  {
    out.push_back(static_cast<uint8_t>((value >> (8 * i)) & 0xFF));
  }
}

// 16-bit PCM, as hkp-python writes it: clipped rather than scaled, because a
// sample outside -1..1 was already too loud when it was made.
BinaryData encodeWav(const std::vector<float>& samples, int sampleRate, int channels)
{
  const uint32_t dataBytes = static_cast<uint32_t>(samples.size() * 2);
  BinaryData out;
  out.reserve(44 + dataBytes);
  out.insert(out.end(), {'R', 'I', 'F', 'F'});
  putLE(out, 36 + dataBytes, 4);
  out.insert(out.end(), {'W', 'A', 'V', 'E', 'f', 'm', 't', ' '});
  putLE(out, 16, 4);                               // fmt chunk size
  putLE(out, 1, 2);                                // PCM
  putLE(out, channels, 2);
  putLE(out, sampleRate, 4);
  putLE(out, sampleRate * channels * 2, 4);        // byte rate
  putLE(out, channels * 2, 2);                     // block align
  putLE(out, 16, 2);                               // bits per sample
  out.insert(out.end(), {'d', 'a', 't', 'a'});
  putLE(out, dataBytes, 4);
  for (float value : samples)
  {
    const int16_t sample = value >= 1.0f ? 32767
                         : value <= -1.0f ? -32768
                         : static_cast<int16_t>(value * 32767.0f);
    putLE(out, static_cast<uint16_t>(sample), 2);
  }
  return out;
}

} // namespace

// ── The encoder ─────────────────────────────────────────────────────────────

class AudioEncode::Mp3Stream
{
public:
#if HKP_MP3_ENABLED
  static std::unique_ptr<Mp3Stream> create(int sampleRate, int channels, int bitrate,
                                           int quality, std::string& error)
  {
    lame_t lame = lame_init();
    if (!lame)
    {
      error = "audio-encode could not create an mp3 encoder";
      return nullptr;
    }
    lame_set_in_samplerate(lame, sampleRate);
    lame_set_num_channels(lame, channels);
    lame_set_mode(lame, channels == 1 ? MONO : JOINT_STEREO);
    lame_set_brate(lame, bitrate);
    lame_set_quality(lame, quality);
    // No informational tag frame: it is written at the end of a file, which a
    // stream never reaches, and what a recording is called belongs to whatever
    // keeps it.
    lame_set_bWriteVbrTag(lame, 0);

    // Keep the rate the samples were made at where MP3 can carry it, rather
    // than letting the encoder resample to a rate of its choosing.
    static constexpr int kMp3Rates[] = {8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000};
    if (std::find(std::begin(kMp3Rates), std::end(kMp3Rates), sampleRate) != std::end(kMp3Rates))
    {
      lame_set_out_samplerate(lame, sampleRate);
    }

    if (lame_init_params(lame) < 0)
    {
      lame_close(lame);
      error = "audio-encode: the mp3 encoder rejected sampleRate " + std::to_string(sampleRate) +
              " / bitrate " + std::to_string(bitrate);
      return nullptr;
    }
    return std::unique_ptr<Mp3Stream>(new Mp3Stream(lame, channels));
  }

  ~Mp3Stream() { lame_close(m_lame); }

  // Encodes `frames` interleaved frames into `out`, which is grown but never
  // shrunk. Answers the bytes written, or a negative LAME error.
  int encode(const float* pcm, int frames, std::vector<uint8_t>& out)
  {
    const auto bound = mp3BufferBound(frames);
    if (out.size() < bound)
    {
      out.resize(bound);
    }
    if (m_channels == 1)
    {
      // The right channel is not read for a mono encoder.
      return lame_encode_buffer_ieee_float(m_lame, pcm, pcm, frames, out.data(),
                                           static_cast<int>(out.size()));
    }
    return lame_encode_buffer_interleaved_ieee_float(m_lame, pcm, frames, out.data(),
                                                     static_cast<int>(out.size()));
  }

  // What the encoder still holds, ending the recording.
  int flush(std::vector<uint8_t>& out)
  {
    if (out.size() < 7200)
    {
      out.resize(7200);
    }
    return lame_encode_flush(m_lame, out.data(), static_cast<int>(out.size()));
  }

private:
  Mp3Stream(lame_t lame, int channels) : m_lame(lame), m_channels(channels) {}

  lame_t m_lame;
  int m_channels;
#else
  static std::unique_ptr<Mp3Stream> create(int, int, int, int, std::string& error)
  {
    error = kNotCompiled;
    return nullptr;
  }
  int encode(const float*, int, std::vector<uint8_t>&) { return -1; }
  int flush(std::vector<uint8_t>&) { return -1; }
#endif
};

// ── The service ─────────────────────────────────────────────────────────────

AudioEncode::AudioEncode(const std::string& instanceId)
  : Service(instanceId, serviceId())
{
}

AudioEncode::~AudioEncode() = default;

json AudioEncode::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    const auto& j = *buf;
    const auto previous = std::make_tuple(m_format, m_bitrate, m_quality, m_sampleRate, m_channels, m_stream);

    if (j.contains("format") && j["format"].is_string())
    {
      const auto format = j["format"].get<std::string>();
      if (format == "mp3" || format == "wav")
      {
        m_format = format;
      }
    }
    if (j.contains("bitrate") && j["bitrate"].is_number_integer())
    {
      const int bitrate = j["bitrate"].get<int>();
      if (bitrate >= 8 && bitrate <= 320) m_bitrate = bitrate;
    }
    if (j.contains("quality") && j["quality"].is_number_integer())
    {
      const int quality = j["quality"].get<int>();
      if (quality >= 0 && quality <= 9) m_quality = quality;
    }
    if (j.contains("sampleRate") && j["sampleRate"].is_number())
    {
      const int rate = static_cast<int>(j["sampleRate"].get<double>());
      if (rate >= 8000 && rate <= 192000) m_sampleRate = rate;
    }
    if (j.contains("channels") && j["channels"].is_number_integer())
    {
      const int channels = j["channels"].get<int>();
      if (channels == 1 || channels == 2) m_channels = channels;
    }
    if (j.contains("stream") && j["stream"].is_boolean())
    {
      m_stream = j["stream"].get<bool>();
    }

    // A stream is one recording made with one set of settings. Changing any
    // of them ends it; the next pass starts another.
    if (previous != std::make_tuple(m_format, m_bitrate, m_quality, m_sampleRate, m_channels, m_stream))
    {
      m_mp3.reset();
    }
  }
  Service::configure(data);
  return getState();
}

json AudioEncode::getState() const
{
#if HKP_MP3_ENABLED
  const json formats = json::array({"mp3", "wav"});
#else
  const json formats = json::array({"wav"});
#endif
  json state = {
    {"format", m_format},
    {"bitrate", m_bitrate},
    {"quality", m_quality},
    {"sampleRate", m_sampleRate},
    {"channels", m_channels},
    {"stream", m_stream},
    {"lastBytes", m_lastBytes},
    {"lastSeconds", std::round(m_lastSeconds * 1000.0) / 1000.0},
    {"availableFormats", formats},
    {"error", m_error},
  };
  if (m_stream)
  {
    state["streamedBytes"] = m_streamedBytes;
    state["streamedSeconds"] = std::round(m_frames.seconds() * 1000.0) / 1000.0;
  }
  return mergeStateWith(state);
}

Data AudioEncode::process(Data data)
{
  if (isNull(data) || isUndefined(data))
  {
    return Null();
  }
  auto input = getRingBufferFromData(data);
  if (!input)
  {
    return fail("audio-encode expects FloatRingBuffer input (float32 samples)");
  }
  return m_stream ? encodeStream(*input) : encodeOnce(*input);
}

Data AudioEncode::encodeOnce(FloatRingBuffer& input)
{
  std::vector<float> samples;
  input.consumeAvailable(samples, true);
  if (samples.empty())
  {
    return fail("audio-encode was given no samples");
  }

  BinaryData encoded;
  if (m_format == "wav")
  {
    encoded = encodeWav(samples, m_sampleRate, m_channels);
  }
  else
  {
    std::string error;
    auto mp3 = Mp3Stream::create(m_sampleRate, m_channels, m_bitrate, m_quality, error);
    if (!mp3)
    {
      return fail(error);
    }
    std::vector<uint8_t> buffer;
    const int frames = static_cast<int>(samples.size() / m_channels);
    const int written = mp3->encode(samples.data(), frames, buffer);
    if (written < 0)
    {
      return fail("audio-encode: the mp3 encoder failed (" + std::to_string(written) + ")");
    }
    encoded.assign(buffer.begin(), buffer.begin() + written);
    const int flushed = mp3->flush(buffer);
    if (flushed > 0)
    {
      encoded.insert(encoded.end(), buffer.begin(), buffer.begin() + flushed);
    }
  }

  m_error.clear();
  m_lastBytes = encoded.size();
  m_lastSeconds = static_cast<double>(samples.size()) / (m_sampleRate * m_channels);
  sendNotification(getState());
  return Data(std::move(encoded));
}

Data AudioEncode::encodeStream(FloatRingBuffer& input)
{
  if (m_format != "mp3")
  {
    return fail("audio-encode streams mp3 only");
  }
  if (!m_mp3)
  {
    std::string error;
    m_mp3 = Mp3Stream::create(m_sampleRate, m_channels, m_bitrate, m_quality, error);
    if (!m_mp3)
    {
      return fail(error);
    }
    m_frames.reset();
    m_streamedBytes = 0;
  }

  // Whatever arrived since the last pass. A writer appends whole frames, so a
  // remainder only appears after the buffer overran and resynchronised; those
  // few samples are dropped rather than carried into the next frame's place.
  input.consumeAvailable(m_pcm, true);
  const int frames = static_cast<int>(m_pcm.size() / m_channels);
  if (frames == 0)
  {
    return Null();
  }

  const int written = m_mp3->encode(m_pcm.data(), frames, m_encoded);
  if (written < 0)
  {
    return fail("audio-encode: the mp3 encoder failed (" + std::to_string(written) + ")");
  }

  // The encoder holds back what its model still needs, so most passes finish
  // no frame or one; only whole frames go on.
  BinaryData out;
  m_frames.push(m_encoded.data(), static_cast<std::size_t>(written), out);
  if (out.empty())
  {
    return Null();
  }

  m_error.clear();
  m_lastBytes = out.size();
  m_lastSeconds = static_cast<double>(frames) / m_sampleRate;
  m_streamedBytes += out.size();
  notifyThrottled();
  return Data(std::move(out));
}

Data AudioEncode::fail(const std::string& message)
{
  // A stream failing fails on every pass; say so once, not forty times a second.
  if (message != m_error)
  {
    m_error = message;
    sendNotification(getState());
  }
  return Data(json{{"error", message}});
}

void AudioEncode::notifyThrottled()
{
  const auto now = std::chrono::steady_clock::now();
  if (now - m_lastNotified >= std::chrono::seconds(1))
  {
    m_lastNotified = now;
    sendNotification(getState());
  }
}

} // namespace hkp
