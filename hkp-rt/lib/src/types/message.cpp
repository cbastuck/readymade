#include <types/message.h>

#include <yas/buffers.hpp>
#include <yas/serialize.hpp>
#include <yas/std_types.hpp>

namespace hkp { 

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
  uint16_t purposeValue = purpose;
  uint16_t dataType = getTypeId(data);
  constexpr std::size_t flags = yas::mem | yas::binary;
  
  auto o = YAS_OBJECT_NVP(nullptr,
     ("messagePurpose", purposeValue),
     ("dataType", dataType),
     ("sender", sender)
  );

  yas::shared_buffer header = yas::save<flags>(o);
  yas::shared_buffer payload;
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
  else if (isNull(data)) {
    payload = yas::shared_buffer("0", 1);
  }
  else 
  {
    auto str = stringify(data);
    payload = yas::save<flags>(YAS_OBJECT_NVP(nullptr, ("value", str)));
  }
  stream.binary(true);
  std::vector<boost::asio::const_buffer> buffers{
    boost::asio::const_buffer(header.data.get(), header.size),
    boost::asio::const_buffer(payload.data.get(), payload.size)
  };
  stream.write(buffers);
}

}
