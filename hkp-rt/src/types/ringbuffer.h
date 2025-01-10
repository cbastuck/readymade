#pragma once

#include <boost/beast.hpp>

#include <sstream>
#include <iostream>

#include <yas/buffers.hpp>

namespace beast = boost::beast;

constexpr unsigned int BUFFER_SIZE = 64 * 2;

class FloatRingBuffer
{
public:
  static void createFromSerialised(beast::flat_buffer buffer, unsigned int size, FloatRingBuffer& target);
  static uint64_t timeSinceEpochMillisec();

  FloatRingBuffer(std::string name = "unnamed buffer");

  void append(float value);
  void appendBinary(const char *data, unsigned int count);
  void consumeBinary(float *outputBuffer, unsigned int frameCount, unsigned int numChannels);

  unsigned int availableCount() const;
  yas::shared_buffer serialise() const;

  void resyncIfNeeded();

  uint64_t age() const;
  unsigned int id() const { return m_id; }
  uint64_t timestamp() const { return m_timestamp; }

private:
  static unsigned int m_bufferAutoId;
  inline static const unsigned int N = 44100 * 2;
  float m_buffer[N];
  std::atomic<std::uint32_t> m_writeIndex;
  std::atomic<std::uint32_t> mutable m_readIndex; // mutable because serialise modifies it
  std::string m_name;
  unsigned int m_id;
  uint64_t m_timestamp;
};