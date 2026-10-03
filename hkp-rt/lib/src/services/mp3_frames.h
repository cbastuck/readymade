#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

namespace hkp {

// What the four-byte header at the start of an MPEG audio Layer III frame
// says about the frame.
struct Mp3FrameHeader
{
  unsigned int length = 0;          // bytes, header included
  unsigned int sampleRate = 0;
  unsigned int samplesPerFrame = 0; // per channel
};

// The header at `data`, or nothing where those bytes are not the start of a
// Layer III frame.
inline std::optional<Mp3FrameHeader> parseMp3FrameHeader(const uint8_t* data, size_t size)
{
  if (size < 4 || data[0] != 0xFF || (data[1] & 0xE0) != 0xE0)
  {
    return std::nullopt;
  }

  const unsigned int version = (data[1] >> 3) & 0x3; // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5
  const unsigned int layer = (data[1] >> 1) & 0x3;   // 1: Layer III
  const unsigned int bitrateIndex = (data[2] >> 4) & 0xF;
  const unsigned int rateIndex = (data[2] >> 2) & 0x3;
  const unsigned int padding = (data[2] >> 1) & 0x1;

  if (version == 1 || layer != 1 || bitrateIndex == 0 || bitrateIndex == 15 || rateIndex == 3)
  {
    return std::nullopt;
  }

  static constexpr std::array<unsigned int, 15> kMpeg1Kbps = {
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320};
  static constexpr std::array<unsigned int, 15> kMpeg2Kbps = {
    0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160};
  static constexpr std::array<unsigned int, 3> kMpeg1Rates = {44100, 48000, 32000};

  const bool mpeg1 = version == 3;
  const unsigned int bitrate = (mpeg1 ? kMpeg1Kbps : kMpeg2Kbps)[bitrateIndex] * 1000;
  const unsigned int divisor = version == 3 ? 1 : version == 2 ? 2 : 4;

  Mp3FrameHeader header;
  header.sampleRate = kMpeg1Rates[rateIndex] / divisor;
  header.samplesPerFrame = mpeg1 ? 1152 : 576;
  header.length = (mpeg1 ? 144 : 72) * bitrate / header.sampleRate + padding;
  return header;
}

// Cuts an MP3 byte stream into whole frames.
//
// An encoder hands its output over in whatever pieces it has ready, and a
// piece need not end where a frame does. Anything that treats a piece as a
// unit — a listener joining a stream between two of them, a backlog replayed
// to that listener — needs every piece to start on a frame. This holds back
// the tail of an unfinished frame until the rest of it arrives.
class Mp3FrameSplitter
{
public:
  // Appends `size` bytes and moves every frame they complete into `frames`,
  // which is appended to, not replaced. Answers how many frames that was.
  size_t push(const uint8_t* data, size_t size, std::vector<uint8_t>& frames)
  {
    m_pending.insert(m_pending.end(), data, data + size);

    size_t offset = 0;
    size_t count = 0;
    while (offset + 4 <= m_pending.size())
    {
      const auto header = parseMp3FrameHeader(m_pending.data() + offset, m_pending.size() - offset);
      if (!header)
      {
        // Not on a frame: find the next one. An encoder's own output never
        // gets here, but a byte that does not start a frame cannot be sent as
        // one either.
        ++offset;
        continue;
      }
      if (offset + header->length > m_pending.size())
      {
        break; // the rest of this frame has not arrived
      }
      frames.insert(frames.end(), m_pending.begin() + offset, m_pending.begin() + offset + header->length);
      offset += header->length;
      m_samplesPerChannel += header->samplesPerFrame;
      m_sampleRate = header->sampleRate;
      ++count;
    }
    m_pending.erase(m_pending.begin(), m_pending.begin() + offset);
    return count;
  }

  void reset()
  {
    m_pending.clear();
    m_samplesPerChannel = 0;
    m_sampleRate = 0;
  }

  // How much audio the frames handed out so far hold.
  double seconds() const
  {
    return m_sampleRate ? static_cast<double>(m_samplesPerChannel) / m_sampleRate : 0.0;
  }

private:
  std::vector<uint8_t> m_pending;
  uint64_t m_samplesPerChannel = 0;
  unsigned int m_sampleRate = 0;
};

} // namespace hkp
