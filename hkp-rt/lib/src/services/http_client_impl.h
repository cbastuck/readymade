#pragma once 

#include <map>

#include <boost/beast/http.hpp>

namespace hkp {
  
struct HttpClientImpl
{
  boost::asio::io_context ioc;
  std::string userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Safari/605.1.15";
  std::string url;
  std::string method = "get";
  std::map<std::string, std::string> headers;
  std::string body;

  boost::beast::http::verb getMethodFromString(const std::string& s)
  {
    if (s == "get") 
    {
      return boost::beast::http::verb::get;
    }
    if (s == "post") 
    {
      return boost::beast::http::verb::post;
    }
    if (s == "put") 
    {
      return boost::beast::http::verb::put;
    }
    if (s == "delete") 
    {
      return boost::beast::http::verb::delete_;
    }
    return boost::beast::http::verb::unknown;  
  }
};

}
