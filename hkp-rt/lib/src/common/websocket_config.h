#pragma once

#include <string>
#include <types/types.h>

namespace hkp {
struct WebsocketConfig
{
  std::string host;
  std::string port;
  std::string path;

  static WebsocketConfig withHost(const std::string& host)
  {
    WebsocketConfig config;
    config.host = host;
    return config;
  }

  static std::optional<WebsocketConfig> fromJSON(const json& buf)
  {
    WebsocketConfig config;
    if (!config.load(buf)) 
    {
      return std::nullopt;
    }

    return std::optional<WebsocketConfig>(config);
  }

  WebsocketConfig& withPath(const std::string& p)
  {
    this->path = p;
    return *this;
  }

  WebsocketConfig& withPort(const std::string& p)
  {
    this->port = p;
    return *this;
  }
  
  WebsocketConfig& withRandomPort()
  {
    this->port = "0";
    return *this;
  }

  bool update(json& buf)
  {
    if (buf.is_null())
    {
      return false;
    }
    if (buf.contains("host"))
    {
      host = buf["host"];
    }
    if (buf.contains("port"))
    {
      port = buf["port"];
    }
    if (buf.contains("path"))
    {
      path = buf["path"];
    }

    return isValid();
  }

  unsigned short portAsNumber() const
  {
    if (port.empty())
    {
      return 0;
    }
    return std::stoi(port);
  }

  bool isValid() const
  {
    return !host.empty() && !port.empty() && !path.empty();
  }

  bool load(json buf)
  {
    if (buf.is_null())
    {
      return false;
    }   
    bool updated = updateIfNeeded(host, buf["host"]);
    updated |= updateIfNeeded(port, buf["port"]);
    updated |= updateIfNeeded(path, buf["path"]);
    return updated;
  }

  json serialise() const
  {
    json buf;
    buf["host"] = host;
    buf["port"] = port;
    buf["path"] = path;
    return buf;
  }

  std::string toString() const
  {
    return host + ":" + port + path;
  }
};


inline std::ostream& operator<<(std::ostream& os, const WebsocketConfig& c)
{
  os << "Host: " << c.host << " Path: " << c.path << " Port: " << c.port << std::endl;
  return os;
} 

}