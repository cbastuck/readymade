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
#include <algorithm>
#include <iostream>
#include <string>

#include "../mount.h"
#include "./root_certificates.h"
#include "../common/inja.h"
#include "../common/string_util.h"  
#include <secrets.h>
#include "../runtime_host.h"

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

/** A method name as the wire spells it, whatever a board wrote. */
static std::string upperCased(const std::string& text)
{
  std::string out = text;
  std::transform(out.begin(), out.end(), out.begin(),
                 [](unsigned char c) { return std::toupper(c); });
  return out;
}

/**
 * The request both transports send.
 *
 * Built in one place because there are two of them — TLS and plain — and what
 * a request carries is a property of the request, not of the socket under it.
 * Held apart, the two drifted: the plain path sent neither the configured
 * headers nor the body, so the same board behaved differently depending on
 * whether its URL began `https` or `http`.
 */
http::request<http::string_body> HttpClient::buildRequest(
    const std::string& method, const std::string& path,
    const std::string& query, const std::string& host, int version,
    const json& j)
{
  // One conversion, because there are two spellings in play: this service's own
  // helper reads the lower-case names a board writes, and Beast's reads the
  // upper-case ones on the wire. Using both on the same string made the verb
  // right and the body decision wrong — a board saying "post" sent no body.
  auto methodVerb = http::string_to_verb(upperCased(method));
  if (methodVerb == http::verb::unknown)
  {
    methodVerb = m_impl->getMethodFromString(method);
  }

  http::request<http::string_body> req{methodVerb, path + "?" + query, version};
  req.set(http::field::host, host);
  req.set(http::field::user_agent, m_impl->userAgent);

  // Headers are a free-form map, and a credential is as likely to be part of
  // one — `Bearer <token>` — as to be a field of its own. Resolved against the
  // address being called, so a header bound to one host cannot be sent to
  // another by repointing this service. What comes back is used for this
  // request and dropped; nothing resolved goes back into state.
  auto headers = j.value("headers", m_impl->headers);
  const auto credential = resolveCredential(
      parentHost() ? &parentHost()->secrets() : nullptr, headers, host);
  if (!credential.problem.empty())
  {
    throw std::runtime_error("http-client: " + credential.problem);
  }
  headers = credential.value.get<std::map<std::string, std::string>>();
  for (const auto& header : headers)
  {
    req.set(header.first, processInjaTemplate(header.second, j));
  }

  auto body = j.value("body", m_impl->body);
  if (!body.empty() &&
      (methodVerb == http::verb::post || methodVerb == http::verb::put))
  {
    req.body() = body;
    req.set(http::field::content_length, std::to_string(body.size()));
    req.prepare_payload();
  }
  return req;
}

json HttpClient::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    updateIfNeeded(m_impl->url, (*buf)["url"]);
    updateIfNeeded(m_impl->mount, (*buf)[MOUNT_FIELD]);
    updateIfNeeded(m_impl->path, (*buf)["path"]);
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
    // Reserved name: the board's coordinator reads and rewrites it.
    { MOUNT_FIELD, m_impl->mount },
    { "path", m_impl->path },
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

  // A mount wins over a typed url: naming a service is the more specific
  // instruction, and its address is not knowable when a board is written.
  std::string mount = j.value(MOUNT_FIELD, m_impl->mount);
  std::string url;
  if (!mount.empty())
  {
    if (isMountReference(mount))
    {
      // Only the board's coordinator can turn a reference into an address, and
      // it has not done so yet. Stop rather than fall back to url, which would
      // silently call something the board did not ask for.
      std::cerr << "HTTPClient service: waiting for " << mount
                << " to publish an endpoint" << std::endl;
      return Null();
    }
    url = joinMountPath(mount, j.value("path", m_impl->path));
  }
  else
  {
    if (!j.contains("url") && m_impl->url.empty())
    {
      std::cerr << "HTTPClient service: JSON data does not contain required fields: " << j.dump() <<  std::endl;
      return data;
    }
    std::string urlOrTemplate = j.value("url", m_impl->url);
    url = processInjaTemplate(urlOrTemplate, j);
  }
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

      auto req = buildRequest(method, path, query, host, version, j);

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
      auto req = buildRequest(method, path, query, host, version, j);

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
