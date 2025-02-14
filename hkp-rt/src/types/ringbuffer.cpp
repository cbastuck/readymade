#include "./ringbuffer.h"

#include <yas/serialize.hpp>
#include <yas/std_types.hpp>

unsigned int FloatRingBuffer::m_bufferAutoId = 0;

FloatRingBuffer::FloatRingBuffer(std::string name) 
  : m_name(name), 
    m_id(m_bufferAutoId++),  
    m_writeIndex(0), m_readIndex(0),
    m_timestamp(timeSinceEpochMillisec())
{
  memset(m_buffer, 0, sizeof(m_buffer));
}

void FloatRingBuffer::append(float value)
{
  m_buffer[m_writeIndex++ % N] = value;
}

void FloatRingBuffer::appendBinary(const char *data, unsigned int count)
{
  // std::cout << "FloatRingBuffer.appendBinary: " << m_name << " count: " << count / sizeof(float) << " readpos: " << m_readIndex << " writepos: " << m_writeIndex << std::endl;
  auto numItems = count / sizeof(float);

  const float *src = reinterpret_cast<const float *>(data);
  for (unsigned int i = 0; i < numItems; ++i, ++src)
  {
    m_buffer[m_writeIndex++ % N] = *src;
  }
  return;
}

void FloatRingBuffer::consumeBinary(float *outputBuffer, unsigned int frameCount, unsigned int numChannels)
{
  // std::cout << "FloatRingBuffer.consume: " << m_name << " count: " << frameCount << " readpos: " << m_readIndex << " writepos: " << m_writeIndex << std::endl;
  auto availableSamples = m_writeIndex - m_readIndex;
  unsigned int framesToCopy = std::min(availableSamples, frameCount);
  for (unsigned int i = 0; i < framesToCopy; ++i, ++m_readIndex)
  {
    for (unsigned int j = 0; j < numChannels; ++j)
    {
      outputBuffer[i * numChannels + j] = m_buffer[m_readIndex % N]; // TODO: copies mono to all channels
    }
  }

  unsigned int numFillFrames = frameCount - framesToCopy;
  if (numFillFrames > 0)
  {
    for (unsigned int i = 0; i < numFillFrames; ++i)
    {
      for (unsigned int j = 0; j < numChannels; ++j)
      {
        outputBuffer[(framesToCopy + i) * numChannels + j] = 0;
      }
    }
    std::cout << "Filled " << numFillFrames << " samples (w: "<< m_writeIndex << ") \r" << std::flush;
  }
}

void FloatRingBuffer::resyncIfNeeded() 
{
   unsigned int availableSamples = m_writeIndex - m_readIndex;
  if (availableSamples > N)
  {
    std::cout << "FloatRingBuffer::serialise the write buffer wrapped twice - increase the buffer size - Resetting indices" << std::endl;
    m_readIndex.store(m_writeIndex - N);
  }
}

yas::shared_buffer FloatRingBuffer::serialise() const
{
  unsigned int availableSamples = m_writeIndex - m_readIndex;
  if (availableSamples > N)
  {
    std::cerr << "FloatRingBuffer::serialise the write buffer wrapped twice - increase the buffer size - Resetting indices" << std::endl;
    m_readIndex.store(m_writeIndex - N);
  }

  auto numSavedSamples = std::min(availableSamples, N);
  float continuousBuffer[N]; // contains all samples in one continuous buffer
  for (unsigned int i = 0; i < numSavedSamples; ++i)
  {
    continuousBuffer[i] = m_buffer[(m_readIndex + i) % N];
  }
  m_readIndex += numSavedSamples;

  constexpr std::size_t flags = yas::mem | yas::binary;
  auto o = YAS_OBJECT_NVP(nullptr,
                          ("array", yas::array(&continuousBuffer[0], numSavedSamples)),
                          ("id", m_id), ("ts", timeSinceEpochMillisec()));
  return yas::save<flags>(o);
}

// TODO: should be renamed to not contain create in the name
void FloatRingBuffer::createFromSerialised(beast::flat_buffer buffer, unsigned int size, FloatRingBuffer& target)
{
  const char *rawData = reinterpret_cast<const char *>(buffer.data().data());
  yas::shared_buffer buf(rawData, size);

  float *iptr = nullptr;
  std::size_t isize = 0;
  auto arrholder = yas::array(&iptr, &isize);

  unsigned int id = 0;
  uint64_t ts = 0;
  auto iobj = YAS_OBJECT_NVP(nullptr, ("array", arrholder), ("id", id), ("ts", ts));
  constexpr std::size_t flags = yas::mem | yas::binary;
  yas::load<flags>(buf, iobj);

  target.appendBinary(reinterpret_cast<char *>(iptr), isize * sizeof(float));
  target.m_id = id;
  target.m_timestamp = ts;

  auto delta = target.age();
  static unsigned int averageTs = 0;
  static unsigned int count = 0;
  averageTs += delta;
  if (++count % 10 == 0)
  {
    std::cout << "Average round-trip latency: " << averageTs / static_cast<float>(count) << "msec\r" << std::flush;
    averageTs = 0;
    count = 0;
  }

  arrholder.free(iptr);
}

uint64_t FloatRingBuffer::timeSinceEpochMillisec()
{
  using namespace std::chrono;
  return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

uint64_t FloatRingBuffer::age() const
{
  auto currentTs = timeSinceEpochMillisec();
  auto delta = currentTs - m_timestamp;
  return delta;
}

unsigned int FloatRingBuffer::availableCount() const
{
  return m_writeIndex - m_readIndex;
}

std::ostream& operator<<(std::ostream& os, const FloatRingBuffer& data)
{
  os << "FloatRingBuffer: " << data.id() << " " << data.availableCount() << std::endl;
  os << "ReadIndex: " << data.getReadIndex() << " WriteIndex: " << data.getWriteIndex() << std::endl;
  for (unsigned int i = 0, idx=data.m_readIndex; i < data.availableCount(); ++i, ++idx)
  {
    os << data.m_buffer[idx] << " ";
  }
  os << std::endl;
  return os;
}