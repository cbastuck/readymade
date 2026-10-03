#pragma once

#include <sstream>
#include <iostream>
#include <atomic>
#include <cstdint>
#include <vector>

#include "./audio.h"

namespace yas{
  struct shared_buffer;
}

namespace boost {
  namespace beast {
    template<class Allocator>
    class basic_flat_buffer;
  }
}

namespace hkp {

class FloatRingBuffer
{
public:
  
  using BufferType = boost::beast::basic_flat_buffer<std::allocator<char>>;
  static void createFromSerialised(BufferType& buffer, unsigned int size, FloatRingBuffer& target);
  static uint64_t timeSinceEpochMillisec();

  FloatRingBuffer(std::string name = "unnamed buffer");

  void append(float value);
  unsigned int appendBinary(const char *data, unsigned int count);
  unsigned int appendAvailable(FloatRingBuffer& source, bool advanceReadIndex = false);

  unsigned int consumeBinary(float *outputBuffer, unsigned int frameCount, unsigned int numChannels);
  unsigned int consumeAvailable(std::vector<float>& target, bool advanceReadIndex) const;
  unsigned int consumeAvailable(std::vector<uint8_t>& target, bool advanceReadIndex) const;
  unsigned int consumeAvailable(FloatRingBuffer& target);
  unsigned int consumeExact(std::vector<float>& target, unsigned int count);
  void skipSamples(unsigned int count);
  unsigned int consumeAvailableByAppend(std::vector<uint8_t>& target);

  unsigned int availableCount() const;
  yas::shared_buffer serialise() const;

  void resyncIfNeeded();

  uint64_t age() const;
  unsigned int id() const { return m_id; }
  uint64_t timestamp() const { return m_timestamp; }

  uint64_t getReadIndex() const { return m_readIndex.load(std::memory_order_relaxed); }
  uint64_t getWriteIndex() const { return m_writeIndex.load(std::memory_order_relaxed); }

  unsigned int getInternalBufferSize() const { return N; }

  friend std::ostream& operator<<(std::ostream& os, const FloatRingBuffer& data);
private:
  static unsigned int m_bufferAutoId;
  inline static const unsigned int N = 44100 * 2;
  float m_buffer[N];
  // Positions in the stream, never wrapped: the slot is `index % N`. 64 bits
  // because N does not divide 2^32 — a 32-bit index jumps to a different slot
  // when it wraps, which at 48 kHz stereo is after about twelve hours.
  //
  // One writer, one reader. The writer stores its index only after the samples
  // it covers are in place (release), so a reader that sees an index sees the
  // samples behind it.
  std::atomic<std::uint64_t> m_writeIndex;
  std::atomic<std::uint64_t> mutable m_readIndex; // mutable because serialise modifies it
  std::string m_name;
  unsigned int m_id;
  uint64_t m_timestamp;
};

}