#pragma once

#include <boost/asio/buffer.hpp>
#include <boost/beast.hpp>

#include <types/data.h>

namespace hkp {

enum MessagePurpose { 
  NOTIFICATION = 0, 
  RESULT = 1 
};


class Message 
{
public:
  using BufferType = boost::beast::basic_flat_buffer<std::allocator<char>>;
  using WebSocketStream = boost::beast::websocket::stream<boost::beast::tcp_stream>;

  static Data deserialize(BufferType& buffer);
  static void serialize(
    const Data& data, 
    MessagePurpose purpose, 
    const std::string& sender, 
    WebSocketStream& stream
  );

private:

};

}
