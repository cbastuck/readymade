#include "./http_client.h"
#include "./http_client_impl.h"

#include <boost/beast/core.hpp>
//#include <boost/json/src.hpp>
#include <boost/json.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>

#include <boost/url.hpp>
#include <boost/url/scheme.hpp>

#include <cstdlib>
#include <iostream>
#include <string>

#include "./root_certificates.h"
#include "../common/inja.h"
#include "../common/string_util.h"  

namespace beast = boost::beast; // from <boost/beast.hpp>
namespace http = beast::http;   // from <boost/beast/http.hpp>
namespace net = boost::asio;    // from <boost/asio.hpp>
namespace ssl = net::ssl;       // from <boost/asio/ssl.hpp>
namespace urls = boost::urls; // from <boost/url.hpp>
using tcp = net::ip::tcp;       // from <boost/asio/ip/tcp.hpp>
namespace hkp {

HttpClient::HttpClient(const std::string& instanceId)
     : Service(instanceId, serviceId())
     , m_impl(std::make_unique<HttpClientImpl>())
{ 
}

HttpClient::~HttpClient()
{
  m_impl->ioc.stop();
}

json HttpClient::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    updateIfNeeded(m_impl->url, (*buf)["url"]);
    updateIfNeeded(m_impl->userAgent, (*buf)["userAgent"]);
    updateIfNeeded(m_impl->method, (*buf)["method"]);
    if (buf->contains("headers"))
    {
      auto headersJson = (*buf)["headers"];
      if (headersJson.is_object())
      {
        m_impl->headers.clear(); // Clear existing headers before adding new ones
        for (auto& [key, value] : headersJson.items())
        {
          m_impl->headers[key] = value;
        }
      }
    }
    updateIfNeeded(m_impl->body, (*buf)["body"]);
  };
  return Service::configure(data);
}

std::string HttpClient::getServiceId() const
{
  return serviceId();
}

json HttpClient::getState() const
{
  return Service::mergeStateWith(json{
    { "url", m_impl->url },
    { "userAgent", m_impl->userAgent },
    { "method", m_impl->method },
    { "headers", m_impl->headers },
    { "body", m_impl->body }
  });
}



Data HttpClient::process(Data data)
{
  auto d = getJSONFromData(data);
  if (!d || d->is_null())
  {
    std::cerr << "HTTPClient service: no JSON data provided" << std::endl;
    return data;
  }
  auto j = *d;

  if (j.is_array())
  {
    auto resultArray = json::array();
    for (const auto& item : j)
    {
      auto partialResult = process(Data(item));
      auto partialData = getJSONFromData(partialResult);
      if (partialData)
      {
        resultArray.push_back(*partialData);
      }
    }
    return Data(resultArray);
  }

  if (!j.is_object())
  {
    std::cerr << "HTTPClient service: JSON data is not an object" << std::endl;
    return data;
  }

  if (!j.contains("url") && m_impl->url.empty())
  {
    std::cerr << "HTTPClient service: JSON data does not contain required fields: " << j.dump() <<  std::endl;
    return data;
  }
  std::string urlOrTemplate = j.value("url", m_impl->url);
  std::string url = processInjaTemplate(urlOrTemplate, j);
  std::string method = j.contains("method") ? j["method"] : "get";
   
  try
  {
    boost::system::result< boost::url > u = urls::parse_uri_reference(url).value();
    if (u.has_error())
    {
      std::cerr << "Error: " << u.error().message() << std::endl;
      return data;
    }

    auto host = std::string(u->encoded_host());
    std::string port = u->port();
    if (port.empty())
    {
      port = std::string(u->scheme_id() == urls::scheme::https ? "443" : "80" );
    }
    
    auto path = std::string(u->encoded_path());
    auto query = std::string(u->encoded_query());
    int version = 11;

    beast::error_code ec;
    beast::flat_buffer buffer;
    http::response<http::dynamic_body> res; // Declare a container to hold the response
    if (u->scheme_id() == urls::scheme::https)
    {
      ssl::context ctx(ssl::context::tlsv12_client); // The SSL context is required, and holds certificates
      load_root_certificates(ctx); // This holds the root certificate used for verification
      ctx.set_verify_mode(ssl::verify_peer); // Verify the remote server's certificate
  
      tcp::resolver resolver(m_impl->ioc); // These objects perform our I/O
      beast::ssl_stream<beast::tcp_stream> stream(m_impl->ioc, ctx);
      // Set SNI Hostname (many hosts need this to handshake successfully)
      if(! SSL_set_tlsext_host_name(stream.native_handle(), host.c_str()))
      {
          beast::error_code ec{static_cast<int>(::ERR_get_error()), net::error::get_ssl_category()};
          throw beast::system_error{ec};
      }
      
      auto const results = resolver.resolve(host, port); // Look up the domain name
      beast::get_lowest_layer(stream).connect(results); // Make the connection on the IP address we get from a lookup
      stream.handshake(ssl::stream_base::client); // Perform the SSL handshake

      http::request<http::string_body> req{m_impl->getMethodFromString(method), path + "?" + query, version};
      req.set(http::field::host, host);
      req.set(http::field::user_agent, m_impl->userAgent);
      auto headers = j.value("headers", m_impl->headers);
      for (const auto& header : headers) 
      {
        req.set(header.first, processInjaTemplate(header.second, j));
      }

      auto body = j.value("body", m_impl->body);
      auto methodVerb = http::string_to_verb(method);
      if (!body.empty() && (methodVerb == http::verb::post || methodVerb == http::verb::put))
      {
        req.body() = body;
        req.set(http::field::content_length, std::to_string(body.size()));
        req.prepare_payload();
      }
      if (methodVerb != http::verb::unknown)
      {
        req.method(methodVerb);
      }
      
      http::write(stream, req);
      http::read(stream, buffer, res);
      stream.shutdown(ec);   // Gracefully close the stream
    }
    else
    {
      net::io_context ioc;
      tcp::resolver resolver(ioc);
      beast::tcp_stream stream(ioc);
      auto const results = resolver.resolve(host, port);
      stream.connect(results);
      http::request<http::string_body> req{m_impl->getMethodFromString(method), path + "?" + query, version};
      req.set(http::field::host, host);
      req.set(http::field::user_agent, m_impl->userAgent);
      http::write(stream, req);
      beast::flat_buffer buffer;
      http::read(stream, buffer, res);
      stream.socket().shutdown(tcp::socket::shutdown_both, ec);
    }  
  
    if(ec == net::error::eof || ec == net::ssl::error::stream_truncated)
    {
        // Rationale:
        // http://stackoverflow.com/questions/25587403/boost-asio-ssl-async-shutdown-always-finishes-with-an-error
        // stream_truncated: most servers close TCP without sending TLS close_notify (saves a round-trip).
        ec = {};
    }
    if(ec && ec != beast::errc::not_connected)
    {
      auto err = beast::system_error{ec};
      std::cout << "HTTPClient service error during shutdown: " << err.what() << std::endl;;
    }

    std::string contentType = res.at(boost::beast::http::field::content_type);
    auto isJson = contentType.starts_with("application/json");
    auto isText = contentType.find("text/html") != std::string::npos ||  contentType.find("text/plain") != std::string::npos;
    if (isJson || isText)
    {
      std::string responseBody = boost::beast::buffers_to_string(res.body().data());
      return (isJson) ? Data(json::parse(responseBody)) : Data(responseBody);
    }
    else{
      const auto& body = res.body().data();
      MixedData result;
      result.meta = {{"path", url}};
      result.binary.reserve(boost::asio::buffer_size(body));
      for (auto const& buf : body)
        result.binary.insert(result.binary.end(),
                             static_cast<const uint8_t*>(buf.data()),
                             static_cast<const uint8_t*>(buf.data()) + buf.size());
      return Data(result);
    }
  }
  catch(std::exception const& e)
  {
      std::cerr << "HTTPClient service Error: " << e.what() << std::endl;
      return Null();
  }
}

}
