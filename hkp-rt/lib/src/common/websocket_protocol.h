#pragma once

#include <string>

#include <nlohmann/json.hpp>
using json = nlohmann::json;

namespace hkp {
struct WebsocketProtocol
{
  static WebsocketProtocol parse(const std::string& s)
  {
    auto buf = json::parse(s);
    WebsocketProtocol protocol;
    if (!buf.contains("id") || !buf.contains("type"))
    {
      throw std::runtime_error("WebsocketProtocol::parse: invalid protocol");
    }
    protocol.id = buf["id"];
    protocol.type = buf["type"];
    return protocol;
  }

  std::string id;
  std::string type;
};

}
