#include <types/ringbuffer.h>

#include <boost/beast.hpp>

#include <yas/buffers.hpp>
#include <yas/serialize.hpp>
#include <yas/std_types.hpp>

#include <types/data.h>

namespace beast = boost::beast;

namespace hkp {

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

unsigned int FloatRingBuffer::appendBinary(const char *data, unsigned int count)
{
  // std::cout << "FloatRingBuffer.appendBinary: " << m_name << " count: " << count / sizeof(float) << " readpos: " << m_readIndex << " writepos: " << m_writeIndex << std::endl;
  auto numItems = count / sizeof(float);

  const float *src = reinterpret_cast<const float *>(data);
  for (unsigned int i = 0; i < numItems; ++i, ++src)
  {
    m_buffer[m_writeIndex++ % N] = *src;
  }
  return numItems;
}

unsigned int FloatRingBuffer::appendAvailable(FloatRingBuffer& source, bool advanceReadIndex)
{
  auto srcReadIndex = source.m_readIndex.load(std::memory_order_relaxed);
  auto srcWriteIndex = source.m_writeIndex.load(std::memory_order_relaxed);
  unsigned int availableSamples = srcWriteIndex - srcReadIndex;

  if (availableSamples > N)
  {
    std::cerr << "FloatRingBuffer::appendAvailable the source buffer wrapped twice - increase the buffer size - Resetting indices" << std::endl;
    srcReadIndex = source.m_writeIndex - N;
    availableSamples = N; // reset to max size
  }

  for (unsigned int i = 0; i < availableSamples; ++i)
  {
    m_buffer[m_writeIndex++ % N] = source.m_buffer[(srcReadIndex + i) % N];
  } 

  if (advanceReadIndex)
  {
    source.m_readIndex += availableSamples; // move read index forward
  }
  return availableSamples;
}

unsigned int FloatRingBuffer::consumeAvailable(FloatRingBuffer& target)
{
  return target.appendAvailable(*this, true); // append to self
}

unsigned int FloatRingBuffer::consumeAvailableByAppend(std::vector<uint8_t>& target)
{
  auto srcReadIndex = m_readIndex.load(std::memory_order_relaxed);
  auto srcWriteIndex = m_writeIndex.load(std::memory_order_relaxed);
  unsigned int availableSamples = srcWriteIndex - srcReadIndex;
  if (availableSamples > N)
  {
    std::cerr << "FloatRingBuffer::appendAvailable the source buffer wrapped twice - increase the buffer size - Resetting indices" << std::endl;
    srcReadIndex = m_writeIndex - N;
    availableSamples = N; // reset to max size
  }
  target.reserve(target.size() + availableSamples * sizeof(float));
  for (unsigned int i = 0; i < availableSamples; ++i)
  {
    float value = m_buffer[(srcReadIndex + i) % N];
    target.insert(
      target.end(),
      reinterpret_cast<const uint8_t*>(&value),
      reinterpret_cast<const uint8_t*>(&value) + sizeof(float)
    );
  } 

  m_readIndex += availableSamples; // move read index forward
  return availableSamples;
}

unsigned int FloatRingBuffer::consumeBinary(float *outputBuffer, unsigned int frameCount, unsigned int numChannels)
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
  return framesToCopy;
}

unsigned int FloatRingBuffer::consumeAvailable(std::vector<float>& target, bool advanceReadIndex) const
{
  unsigned int availableSamples = m_writeIndex - m_readIndex;
  if (availableSamples > N)
  {
    std::cerr << "FloatRingBuffer::copyAvailable the write buffer wrapped twice - increase the buffer size - Resetting indices" << std::endl;
    if (advanceReadIndex)
    {
      m_readIndex.store(m_writeIndex - N);
    }
    availableSamples = N; // reset to max size
  }

  target.resize(availableSamples);
  for (unsigned int i = 0; i < availableSamples; ++i)
  {
    target[i] = m_buffer[(m_readIndex + i) % N];
  }

  if (advanceReadIndex)
  {
    m_readIndex += availableSamples; // move read index forward
  }
    
  return availableSamples;
}

unsigned int FloatRingBuffer::consumeAvailable(std::vector<uint8_t>& target, bool advanceReadIndex) const
{
  unsigned int availableSamples = m_writeIndex - m_readIndex;
  if (availableSamples > N)
  {
    std::cerr << "FloatRingBuffer::copyAvailable the write buffer wrapped twice - increase the buffer size - Resetting indices" << std::endl;
    if (advanceReadIndex)
    {
      m_readIndex.store(m_writeIndex - N);
    }
    availableSamples = N; // reset to max size
  }

  target.resize(availableSamples * sizeof(float));
  for (unsigned int i = 0; i < availableSamples; ++i)
  {
    float value = m_buffer[(m_readIndex + i) % N];
    std::memcpy(&target[i * sizeof(float)], &value, sizeof(float));
  }

  if (advanceReadIndex)
  {
    m_readIndex += availableSamples; // move read index forward
  }
    
  return availableSamples;
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
                          ("type", getTypeId<FloatRingBuffer>()),
                          ("array", yas::array(&continuousBuffer[0], numSavedSamples)),
                          ("id", m_id), 
                          ("ts", timeSinceEpochMillisec())
                        );
  return yas::save<flags>(o);
}

// TODO: should be renamed to not contain create in the name
void FloatRingBuffer::createFromSerialised(BufferType& buffer, unsigned int size, FloatRingBuffer& target)
{
  const char *rawData = reinterpret_cast<const char *>(buffer.data().data());
  yas::intrusive_buffer buf(rawData, buffer.size());

  float *iptr = nullptr;
  std::size_t isize = 0;
  auto arrholder = yas::array(&iptr, &isize);

  unsigned int id = 0;
  uint64_t ts = 0;
  unsigned int type;
  auto iobj = YAS_OBJECT_NVP(
    nullptr,
    ("type", type),
    ("array", arrholder), 
    ("id", id), 
    ("ts", ts)
  );
  

  constexpr std::size_t flags = yas::mem | yas::binary;
  yas::load<flags>(buf, iobj);
  
  if (type != getTypeId<FloatRingBuffer>())
  {
    std::cerr << "FloatRingBuffer::createFromSerialised: type mismatch - got: " << type << std::endl;
    return;
  }

  target.appendBinary(reinterpret_cast<char *>(iptr), isize * sizeof(float));
  target.m_id = id;
  target.m_timestamp = ts;

  auto delta = target.age();
  static unsigned int averageTs = 0;
  static unsigned int count = 0;
  averageTs += delta;
  if (++count % 10 == 0)
  {
    std::cout << "FloatRingBuffer::createFromSerialised round-trip latency: " << averageTs / static_cast<float>(count) << "msec" << std::endl;
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

}