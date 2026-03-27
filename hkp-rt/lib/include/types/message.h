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

private:

};

}
