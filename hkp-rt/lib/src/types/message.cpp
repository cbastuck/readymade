#include <types/message.h>

#include <cstring>

#include <yas/buffers.hpp>
#include <yas/serialize.hpp>
#include <yas/std_types.hpp>

namespace hkp {

namespace {

// Builds the YAS header + payload buffers for a message. Shared by every
// serialize variant so the wire format stays identical regardless of transport.
void buildFrame(const Data& data, MessagePurpose purpose, const std::string& sender,
                yas::shared_buffer& header, yas::shared_buffer& payload)
{
  uint16_t purposeValue = purpose;
  uint16_t dataType = getTypeId(data);
  constexpr std::size_t flags = yas::mem | yas::binary;

  auto o = YAS_OBJECT_NVP(nullptr,
     ("messagePurpose", purposeValue),
     ("dataType", dataType),
     ("sender", sender)
  );
  header = yas::save<flags>(o);

  if (auto binary = getBinaryFromData(data))
  {
    payload.assign(&(*binary)[0], binary->size());
  }
  else if (auto rb = getRingBufferFromData(data))
  {
    payload = rb->serialise();
  }
  else if (isUndefined(data))
  {
    payload = yas::shared_buffer("0", 1);
  }
  else if (isNull(data))
  {
    payload = yas::shared_buffer("0", 1);
  }
  else
  {
    auto str = stringify(data);
    payload = yas::save<flags>(YAS_OBJECT_NVP(nullptr, ("value", str)));
  }
}

}  // namespace


Data Message::deserialize(BufferType& buffer, MessageHeader* outHeader)
{
  unsigned int size = static_cast<unsigned int>(buffer.size()); // TODO: check for size limits
  const char *rawData = reinterpret_cast<const char *>(buffer.data().data());
  yas::intrusive_buffer buf(rawData, size);

  uint16_t purposeValue;
  uint16_t dataType;
  std::string sender;
  auto iobj = YAS_OBJECT_NVP(
    nullptr,
    ("messagePurpose", purposeValue),
    ("dataType", dataType),
    ("sender", sender)
  );

  constexpr std::size_t flags = yas::mem | yas::binary;
  yas::load<flags>(buf, iobj);

  size_t messageHeaderSize = 7 // YAS header 
    + sizeof(purposeValue) 
    + sizeof(dataType) 
    + 8 // length of type for storing sender string
    + sender.size();
  buffer.consume(messageHeaderSize); // consume the header

  if (outHeader)
  {
    outHeader->messagePurpose = purposeValue;
    outHeader->dataType = dataType;
    outHeader->sender = sender;
  }
  
  if (dataType == getTypeId<FloatRingBuffer>())
  {
    auto data = std::make_shared<FloatRingBuffer>("Result.FloatRingBuffer");
    FloatRingBuffer::createFromSerialised(buffer, size, *data);
    return data;
  }
  else if (dataType == getTypeId<Null>())
  {
    return Null();
  }
  
  std::cerr << "Message::deserialize data type is not suported" << std::endl;
  return Null();
}

void Message::serialize(const Data& data, MessagePurpose purpose, const std::string& sender, WebSocketStream& stream)
{
  yas::shared_buffer header;
  yas::shared_buffer payload;
  buildFrame(data, purpose, sender, header, payload);

  stream.binary(true);
  std::vector<boost::asio::const_buffer> buffers{
    boost::asio::const_buffer(header.data.get(), header.size),
    boost::asio::const_buffer(payload.data.get(), payload.size)
  };
  stream.write(buffers);
}

std::string Message::serializeToString(const Data& data, MessagePurpose purpose, const std::string& sender)
{
  yas::shared_buffer header;
  yas::shared_buffer payload;
  buildFrame(data, purpose, sender, header, payload);

  std::string out;
  out.reserve(header.size + payload.size);
  out.append(reinterpret_cast<const char*>(header.data.get()), header.size);
  out.append(reinterpret_cast<const char*>(payload.data.get()), payload.size);
  return out;
}

Data Message::deserializeFromString(const std::string& bytes, MessageHeader* outHeader)
{
  BufferType buffer;
  auto mutableArea = buffer.prepare(bytes.size());
  std::memcpy(mutableArea.data(), bytes.data(), bytes.size());
  buffer.commit(bytes.size());
  return deserialize(buffer, outHeader);
}

}
