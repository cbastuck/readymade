#include "./link_socket.h"

#include <deque>
#include <iostream>
#include <string>
#include <type_traits>
#include <utility>

#include <boost/asio/dispatch.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/asio/strand.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/beast/websocket/ssl.hpp>

#include "../services/root_certificates.h"

namespace hkp {

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
namespace ssl = net::ssl;
using tcp = net::ip::tcp;

namespace {

struct Address
{
  bool secure = false;
  std::string host;
  std::string port;
  std::string target;
};

/** Splits a ws/wss/http/https address; false when it is none of those. */
bool parseAddress(const std::string& url, Address& out)
{
  const auto schemeEnd = url.find("://");
  if (schemeEnd == std::string::npos)
  {
    return false;
  }
  const std::string scheme = url.substr(0, schemeEnd);
  if (scheme == "wss" || scheme == "https")
  {
    out.secure = true;
  }
  else if (scheme != "ws" && scheme != "http")
  {
    return false;
  }

  const std::string rest = url.substr(schemeEnd + 3);
  const auto pathStart = rest.find_first_of("/?");
  std::string authority = rest.substr(0, pathStart);
  out.target = pathStart == std::string::npos ? "/" : rest.substr(pathStart);
  if (out.target.empty() || out.target[0] != '/')
  {
    out.target = "/" + out.target;
  }

  // Credentials in an address are not a way in here; the bearer is.
  const auto at = authority.rfind('@');
  if (at != std::string::npos)
  {
    authority = authority.substr(at + 1);
  }

  if (!authority.empty() && authority[0] == '[')
  {
    const auto close = authority.find(']');
    if (close == std::string::npos)
    {
      return false;
    }
    out.host = authority.substr(1, close - 1);
    out.port = close + 1 < authority.size() && authority[close + 1] == ':'
      ? authority.substr(close + 2)
      : "";
  }
  else
  {
    const auto colon = authority.rfind(':');
    out.host = authority.substr(0, colon);
    out.port = colon == std::string::npos ? "" : authority.substr(colon + 1);
  }
  if (out.host.empty())
  {
    return false;
  }
  if (out.port.empty())
  {
    out.port = out.secure ? "443" : "80";
  }
  return true;
}

std::string hostHeader(const Address& address)
{
  const bool defaultPort = address.port == (address.secure ? "443" : "80");
  const bool v6 = address.host.find(':') != std::string::npos;
  const std::string host = v6 ? "[" + address.host + "]" : address.host;
  return defaultPort ? host : host + ":" + address.port;
}

struct Outgoing
{
  std::string bytes;
  bool binary;
};

using PlainStream = websocket::stream<beast::tcp_stream>;
using SecureStream = websocket::stream<beast::ssl_stream<beast::tcp_stream>>;

template <class Stream>
class Connection final
  : public LinkSocket
  , public std::enable_shared_from_this<Connection<Stream>>
{
public:
  // Plain.
  Connection(net::io_context& ioc, Address address, Options options, Handlers handlers)
    : m_address(std::move(address))
    , m_options(std::move(options))
    , m_handlers(std::move(handlers))
    , m_resolver(net::make_strand(ioc))
    , m_ws(m_resolver.get_executor())
  {
  }

  // Secure: the context is owned here, because the stream refers to it.
  Connection(net::io_context& ioc, Address address, Options options, Handlers handlers,
             std::shared_ptr<ssl::context> context)
    : m_address(std::move(address))
    , m_options(std::move(options))
    , m_handlers(std::move(handlers))
    , m_context(std::move(context))
    , m_resolver(net::make_strand(ioc))
    , m_ws(m_resolver.get_executor(), *m_context)
  {
  }

  void start()
  {
    auto self = this->shared_from_this();
    net::dispatch(m_ws.get_executor(), [self]() {
      beast::get_lowest_layer(self->m_ws).expires_after(self->m_options.handshakeTimeout);
      self->m_resolver.async_resolve(
        self->m_address.host, self->m_address.port,
        [self](beast::error_code ec, tcp::resolver::results_type results) {
          if (ec)
          {
            return self->finish("could not resolve " + self->m_address.host + ": " + ec.message());
          }
          beast::get_lowest_layer(self->m_ws).async_connect(
            results,
            [self](beast::error_code ec, tcp::resolver::results_type::endpoint_type) {
              if (ec)
              {
                return self->finish("could not connect: " + ec.message());
              }
              self->secure();
            });
        });
    });
  }

  void sendText(std::string message) override { enqueue(std::move(message), false); }
  void sendBinary(std::string message) override { enqueue(std::move(message), true); }

  void close() override
  {
    auto self = this->shared_from_this();
    net::dispatch(m_ws.get_executor(), [self]() {
      if (self->m_done)
      {
        return;
      }
      // Decided on this side, so nobody is told.
      self->m_done = true;
      self->m_queue.clear();
      if (self->m_open)
      {
        self->m_open = false;
        self->m_ws.async_close(websocket::close_code::normal,
                               [self](beast::error_code) {});
      }
      else
      {
        beast::error_code ignored;
        beast::get_lowest_layer(self->m_ws).socket().close(ignored);
      }
    });
  }

private:
  void secure()
  {
    if constexpr (std::is_same_v<Stream, SecureStream>)
    {
      auto self = this->shared_from_this();
      auto& tls = m_ws.next_layer();
      // The name the certificate is checked against, and the one a server
      // hosting several names picks its certificate by.
      if (!SSL_set_tlsext_host_name(tls.native_handle(), m_address.host.c_str()))
      {
        return finish("could not set the TLS host name");
      }
      tls.set_verify_callback(ssl::host_name_verification(m_address.host));
      tls.async_handshake(ssl::stream_base::client, [self](beast::error_code ec) {
        if (ec)
        {
          return self->finish("TLS handshake failed: " + ec.message());
        }
        self->upgrade();
      });
    }
    else
    {
      upgrade();
    }
  }

  void upgrade()
  {
    auto self = this->shared_from_this();
    // The websocket layer keeps time from here: it bounds its own handshake,
    // and pings a connection that has gone quiet.
    beast::get_lowest_layer(m_ws).expires_never();
    websocket::stream_base::timeout timeout;
    timeout.handshake_timeout = m_options.handshakeTimeout;
    timeout.idle_timeout = m_options.idleTimeout;
    timeout.keep_alive_pings = true;
    m_ws.set_option(timeout);
    // No ceiling of the library's own: exceeding one closes the connection,
    // and a board would lose its runtime over one large value.
    m_ws.read_message_max(0);

    const std::string bearer = m_options.bearer;
    m_ws.set_option(websocket::stream_base::decorator(
      [bearer](websocket::request_type& request) {
        if (!bearer.empty())
        {
          // A header rather than the address, which is what ends up in logs.
          request.set(http::field::authorization, "Bearer " + bearer);
        }
      }));

    m_ws.async_handshake(
      m_response, hostHeader(m_address), m_address.target,
      [self](beast::error_code ec) {
        if (ec)
        {
          Closed closed;
          if (ec == websocket::error::upgrade_declined)
          {
            closed.httpStatus = self->m_response.result_int();
            closed.reason = "the upgrade was refused (" +
              std::to_string(closed.httpStatus) + ")";
          }
          else
          {
            closed.reason = "handshake failed: " + ec.message();
          }
          return self->finish(closed);
        }
        if (self->m_done)
        {
          return;
        }
        self->m_open = true;
        if (self->m_handlers.onOpen)
        {
          self->m_handlers.onOpen();
        }
        self->read();
        self->write();
      });
  }

  void read()
  {
    auto self = this->shared_from_this();
    m_ws.async_read(m_buffer, [self](beast::error_code ec, std::size_t) {
      if (ec)
      {
        Closed closed;
        closed.opened = true;
        if (ec == websocket::error::closed)
        {
          closed.code = self->m_ws.reason().code;
          closed.reason = std::string(self->m_ws.reason().reason.c_str());
        }
        else
        {
          closed.reason = ec.message();
        }
        return self->finish(closed);
      }
      std::string message = beast::buffers_to_string(self->m_buffer.data());
      const bool binary = self->m_ws.got_binary();
      self->m_buffer.consume(self->m_buffer.size());
      if (!self->m_done && self->m_handlers.onMessage)
      {
        self->m_handlers.onMessage(std::move(message), binary);
      }
      if (!self->m_done)
      {
        self->read();
      }
    });
  }

  void enqueue(std::string bytes, bool binary)
  {
    auto self = this->shared_from_this();
    net::post(m_ws.get_executor(),
              [self, bytes = std::move(bytes), binary]() mutable {
      if (self->m_done)
      {
        return;
      }
      self->m_queue.push_back(Outgoing{std::move(bytes), binary});
      self->write();
    });
  }

  // One write at a time: a websocket stream takes no second write while one is
  // in flight.
  void write()
  {
    if (m_writing || !m_open || m_queue.empty())
    {
      return;
    }
    m_writing = true;
    auto self = this->shared_from_this();
    m_ws.binary(m_queue.front().binary);
    m_ws.async_write(net::buffer(m_queue.front().bytes),
                     [self](beast::error_code ec, std::size_t) {
      self->m_writing = false;
      if (ec || self->m_done)
      {
        // The read side reports what happened to the connection.
        return;
      }
      self->m_queue.pop_front();
      self->write();
    });
  }

  void finish(const std::string& reason)
  {
    Closed closed;
    closed.reason = reason;
    finish(closed);
  }

  void finish(const Closed& closed)
  {
    if (m_done)
    {
      return;
    }
    m_done = true;
    m_open = false;
    m_queue.clear();
    beast::error_code ignored;
    beast::get_lowest_layer(m_ws).socket().close(ignored);
    if (m_handlers.onClose)
    {
      m_handlers.onClose(closed);
    }
  }

  Address m_address;
  Options m_options;
  Handlers m_handlers;
  std::shared_ptr<ssl::context> m_context;
  tcp::resolver m_resolver;
  Stream m_ws;
  beast::flat_buffer m_buffer;
  websocket::response_type m_response;
  std::deque<Outgoing> m_queue;
  bool m_writing = false;
  bool m_open = false;
  bool m_done = false;
};

}  // namespace

std::shared_ptr<LinkSocket> LinkSocket::open(net::io_context& ioc, Options options,
                                             Handlers handlers)
{
  Address address;
  if (!parseAddress(options.url, address))
  {
    // Told the same way as any other failure, and never from inside this call.
    const auto onClose = handlers.onClose;
    const std::string url = options.url;
    net::post(ioc, [onClose, url]() {
      if (onClose)
      {
        Closed closed;
        closed.reason = "not a websocket address: " + url;
        onClose(closed);
      }
    });
    return nullptr;
  }

  if (!address.secure)
  {
    auto connection = std::make_shared<Connection<PlainStream>>(
      ioc, std::move(address), std::move(options), std::move(handlers));
    connection->start();
    return connection;
  }

  auto context = std::make_shared<ssl::context>(ssl::context::tls_client);
  beast::error_code ec;
  load_root_certificates(*context, ec);
  if (!options.trustedRootPem.empty())
  {
    context->add_certificate_authority(
      net::buffer(options.trustedRootPem.data(), options.trustedRootPem.size()), ec);
  }
  context->set_verify_mode(ssl::verify_peer);
  auto connection = std::make_shared<Connection<SecureStream>>(
    ioc, std::move(address), std::move(options), std::move(handlers), context);
  connection->start();
  return connection;
}

}
