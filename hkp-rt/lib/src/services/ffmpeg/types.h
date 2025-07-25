#pragma once

#include <string>
#include <memory>

#include "formatcontext.h"

namespace hkp {

class MemoryIO : public av::CustomIO 
{
public:
  MemoryIO()
    : m_pos(0) 
  {
  }

  MemoryIO(const uint8_t* data, size_t buf_size)
    : m_pos(0) 
  {
    m_data.reserve(buf_size);
    m_data.insert(m_data.end(), data, data + buf_size); 
  }

  int read(uint8_t *data, size_t buf_size) override 
  {
      if (m_pos >= m_data.size())
      {
        return AVERROR_EOF;
      }
          
      int toRead = std::min(buf_size, static_cast<size_t>(m_data.size() - m_pos));
      memcpy(data, &m_data[0] + m_pos, toRead);
      m_pos += toRead;
      return toRead;
  }

  int64_t seek(int64_t offset, int whence) override 
  {
    switch (whence) 
    {
      case SEEK_SET:
          m_pos = offset;
          break;
      case SEEK_CUR:
          m_pos += offset;
          break;
      case SEEK_END:
          m_pos = m_data.size() + offset;
          break;
      default:
          return -1;
    }
    if (m_pos < 0 || m_pos > m_data.size())
    {
      return -1;
    }
    return m_pos;
  }

  int write(const uint8_t *data, size_t size) override
  {
    m_data.insert(m_data.end(), data, data + size);
    m_pos += size;
    return size;  
  }

  int patchDataAt(size_t pos, const uint8_t *data, size_t size)
  {
    if (pos + size > m_data.size())
    {
      std::cerr << "MemoryIO::patchDataAt: position out of bounds" << std::endl;
      return -1; // Out of bounds
    }
    memcpy(&m_data[pos], data, size);
    return size;  
  }

  Data data() const 
  {
    return m_data;
  }

  static int write_packet(void* opaque, const uint8_t* buf, int buf_size) 
  {
    MemoryIO* mem_output = static_cast<MemoryIO*>(opaque);
    mem_output->m_data.insert(mem_output->m_data.end(), buf, buf + buf_size);
    return buf_size;
  }

  const std::vector<uint8_t>& dataBuffer() const 
  {
    return m_data;
  }
private:
  std::vector<uint8_t> m_data;
  size_t m_pos;
};

struct OutputType
{
    OutputType(const std::string& filename)
      : filename(filename), memoryIO(nullptr) {}
    OutputType(const std::string& filename, std::shared_ptr<MemoryIO> memoryIO)
      : filename(filename), memoryIO(memoryIO) {}
    ~OutputType() {}
    
    std::string filename;
    std::shared_ptr<MemoryIO> memoryIO;
};

// This is used by the murea plugin to resample audio data!
struct AudioData
{
  unsigned int numChannels;
  unsigned int sampleRate;
  std::vector<std::vector<float> > samples;
};

} // namespace hkp