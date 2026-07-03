#pragma once

#include <boost/asio/buffer.hpp>
#include <boost/beast.hpp>

#include <types/data.h>

namespace hkp {

// this is in sync with Message.ts MessagePurpose enum 
enum MessagePurpose { 
  NOTIFICATION = 0, 
  RESULT = 1, 
  RESULT_AWAITING_RESPONSE = 2,
  RESULT_WITH_REQUEST_ID = 3
};

struct MessageHeader
{
  uint16_t messagePurpose;
  uint16_t dataType;
  std::string sender;
};

class Message 
{
public:
  using BufferType = boost::beast::basic_flat_buffer<std::allocator<char>>;
  using WebSocketStream = boost::beast::websocket::stream<boost::beast::tcp_stream>;

  static Data deserialize(BufferType& buffer, MessageHeader* outHeader = nullptr);
  static void serialize(
    const Data& data,
    MessagePurpose purpose,
    const std::string& sender,
    WebSocketStream& stream
  );

  // String-based variants for transports that work in std::string frames
  // (e.g. Crow WebSocket connections) rather than a Beast stream / flat_buffer.
  // The wire format is identical: YAS header bytes followed by the payload.
  static std::string serializeToString(
    const Data& data,
    MessagePurpose purpose,
    const std::string& sender
  );
  static Data deserializeFromString(
    const std::string& bytes,
    MessageHeader* outHeader = nullptr
  );

private:

};

}
