#pragma once

#include <string>

#include <nlohmann/json.hpp>

namespace hkp {

// The protocol specifies the communiation type of the client,
// e.g. "writer", "reader", or "readwrite". 
// The id is used to identify the client.

struct WebsocketProtocol
{
  static WebsocketProtocol parse(const std::string& s)
  {
    auto buf = nlohmann::json::parse(s);
    WebsocketProtocol protocol;
    if (!buf.contains("id") || !buf.contains("type"))
    {
      auto errorMessage = "WebsocketProtocol::parse: invalid protocol";
      std::cout << errorMessage << std::endl;
      throw std::runtime_error(errorMessage);
    }
    protocol.id = buf["id"];
    protocol.type = buf["type"];
    return protocol;
  }

  std::string id;
  std::string type;
};

}
