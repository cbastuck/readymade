#include "./websocket_writer.h"

#include <chrono>
#include <deque>
#include <functional>
#include <variant>

#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/asio/steady_timer.hpp>
#include <boost/asio/strand.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/beast/websocket/ssl.hpp>

#include <secrets.h>
#include <yas/buffers.hpp>

#include "../mount.h"
#include "../runtime_host.h"
#include "./root_certificates.h"

namespace hkp {

namespace {

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
namespace ssl = net::ssl;
using tcp = net::ip::tcp;

constexpr auto kFirstRetry = std::chrono::milliseconds(500);
constexpr auto kLastRetry = std::chrono::seconds(10);

} // namespace

std::optional<WebsocketTarget> parseWebsocketTarget(const std::string& url)
{
  static const std::pair<const char*, bool> kSchemes[] = {
    {"wss://", true}, {"https://", true}, {"ws://", false}, {"http://", false}};
  for (const auto& [scheme, secure] : kSchemes)
  {
    const std::string prefix(scheme);
    if (url.rfind(prefix, 0) != 0)
    {
      continue;
    }
    const auto rest = url.substr(prefix.size());
    const auto slash = rest.find_first_of("/?");
    const auto authority = rest.substr(0, slash);
    if (authority.empty())
    {
      return std::nullopt;
    }
    WebsocketTarget target;
    target.secure = secure;
    const auto colon = authority.rfind(':');
    target.host = colon == std::string::npos ? authority : authority.substr(0, colon);
    target.port = colon == std::string::npos ? (secure ? "443" : "80") : authority.substr(colon + 1);
    target.path = slash == std::string::npos ? "/" : rest.substr(slash);
    if (target.path.front() == '?')
    {
      target.path.insert(target.path.begin(), '/');
    }
    if (target.host.empty() || target.port.empty())
    {
      return std::nullopt;
    }
    return target;
  }
  return std::nullopt;
}

// ── The connection ──────────────────────────────────────────────────────────

class WebsocketWriter::Link : public std::enable_shared_from_this<Link>
{
public:
  struct Options
  {
    WebsocketTarget target;
    json headers = json::object();
    // Sent first on every connection, as text; empty sends nothing.
    std::string hello;
    std::size_t maxQueueBytes = 16 * 1024;
    // Where `{{secret.…}}` in a header resolves; may be null.
    RuntimeHost* host = nullptr;
    std::function<void(const std::string& status, const std::string& error)> onStatus;
  };

  struct Message
  {
    std::shared_ptr<const std::string> bytes;
    bool binary = true;
  };

  Link(net::io_context& ioc, Options options)
    : m_options(std::move(options))
    , m_strand(net::make_strand(ioc))
    , m_resolver(m_strand)
    , m_timer(m_strand)
    , m_ssl(ssl::context::tlsv12_client)
  {
    load_root_certificates(m_ssl);
    m_ssl.set_verify_mode(ssl::verify_peer);
  }

  void start()
  {
    net::post(m_strand, [self = shared_from_this()]() { self->connect(); });
  }

  // Any thread. Queued; written when connected.
  void send(Message message)
  {
    net::post(m_strand, [self = shared_from_this(), message = std::move(message)]() mutable {
      self->enqueue(std::move(message));
      self->pump();
    });
  }

  // Any thread.
  void stop()
  {
    net::post(m_strand, [self = shared_from_this()]() {
      self->m_stopping = true;
      ++self->m_generation;
      self->m_timer.cancel();
      self->m_resolver.cancel();
      self->closeStream();
    });
  }

  std::atomic<std::uint64_t> sentBytes{0};
  std::atomic<std::uint64_t> droppedMessages{0};
  std::atomic<std::uint64_t> reconnects{0};

private:
  using Plain = websocket::stream<beast::tcp_stream>;
  using Secure = websocket::stream<beast::ssl_stream<beast::tcp_stream>>;

  template <class F>
  void withStream(F&& f)
  {
    std::visit(
      [&](auto& stream) {
        if constexpr (!std::is_same_v<std::decay_t<decltype(stream)>, std::monostate>)
        {
          f(*stream);
        }
      },
      m_ws);
  }

  void status(const std::string& status, const std::string& error = "")
  {
    if (m_options.onStatus)
    {
      m_options.onStatus(status, error);
    }
  }

  void connect()
  {
    if (m_stopping)
    {
      return;
    }
    const auto generation = ++m_generation;
    m_connected = false;
    m_writing = false;
    status("connecting");

    // A fresh stream per attempt: a websocket stream that failed is not reused.
    if (m_options.target.secure)
    {
      m_ws = std::make_unique<Secure>(m_strand, m_ssl);
    }
    else
    {
      m_ws = std::make_unique<Plain>(m_strand);
    }

    m_resolver.async_resolve(
      m_options.target.host, m_options.target.port,
      [self = shared_from_this(), generation](const boost::system::error_code& ec,
                                              tcp::resolver::results_type results) {
        if (generation != self->m_generation) return;
        if (ec) return self->retry("resolve", ec);
        self->withStream([&](auto& ws) {
          beast::get_lowest_layer(ws).expires_after(std::chrono::seconds(10));
          beast::get_lowest_layer(ws).async_connect(
            results, [self, generation](const boost::system::error_code& ec, const tcp::endpoint&) {
              if (generation != self->m_generation) return;
              if (ec) return self->retry("connect", ec);
              self->secure(generation);
            });
        });
      });
  }

  void secure(std::uint64_t generation)
  {
    auto* stream = std::get_if<std::unique_ptr<Secure>>(&m_ws);
    if (!stream)
    {
      return handshake(generation);
    }
    auto& tls = (*stream)->next_layer();
    const auto& host = m_options.target.host;
    SSL_set_tlsext_host_name(tls.native_handle(), host.c_str());
    tls.set_verify_callback(ssl::host_name_verification(host));
    tls.async_handshake(ssl::stream_base::client,
      [self = shared_from_this(), generation](const boost::system::error_code& ec) {
        if (generation != self->m_generation) return;
        if (ec) return self->retry("tls", ec);
        self->handshake(generation);
      });
  }

  void handshake(std::uint64_t generation)
  {
    // Resolved for this attempt and this host, and dropped afterwards: a vault
    // that got its value after the first attempt serves the next one.
    const auto credential = resolveCredential(
      m_options.host ? &m_options.host->secrets() : nullptr, m_options.headers,
      m_options.target.host);
    if (!credential.problem.empty())
    {
      return retry("headers", {}, credential.problem);
    }
    std::vector<std::pair<std::string, std::string>> headers;
    for (const auto& [name, value] : credential.value.items())
    {
      headers.emplace_back(name, value.is_string() ? value.get<std::string>() : value.dump());
    }

    withStream([&](auto& ws) {
      beast::get_lowest_layer(ws).expires_never();
      // Pings on an idle connection, and a peer that stops answering them is a
      // dead one — which is how a connection that vanished without closing
      // (a NAT forgetting it, a laptop sleeping) is noticed at all.
      auto timeouts = websocket::stream_base::timeout::suggested(beast::role_type::client);
      timeouts.idle_timeout = std::chrono::seconds(15);
      timeouts.keep_alive_pings = true;
      ws.set_option(timeouts);
      ws.set_option(websocket::stream_base::decorator([headers](websocket::request_type& req) {
        req.set(http::field::user_agent, "Readymade hkp-rt websocket-writer");
        for (const auto& [name, value] : headers)
        {
          req.set(name, value);
        }
      }));
      ws.async_handshake(m_options.target.host + ":" + m_options.target.port, m_options.target.path,
        [self = shared_from_this(), generation](const boost::system::error_code& ec) {
          if (generation != self->m_generation) return;
          if (ec) return self->retry("handshake", ec);
          self->m_connected = true;
          self->m_retryAfter = kFirstRetry;
          self->status("connected");
          if (!self->m_options.hello.empty())
          {
            self->m_queue.push_front({std::make_shared<const std::string>(self->m_options.hello), false});
            self->m_queuedBytes += self->m_options.hello.size();
          }
          self->read(generation);
          self->pump();
        });
    });
  }

  // Nothing is expected back; reading is how a close from the other side, or
  // a failed ping, shows up.
  void read(std::uint64_t generation)
  {
    withStream([&](auto& ws) {
      ws.async_read(m_readBuffer,
        [self = shared_from_this(), generation](const boost::system::error_code& ec, std::size_t n) {
          if (generation != self->m_generation) return;
          if (ec) return self->retry("read", ec);
          self->m_readBuffer.consume(n);
          self->read(generation);
        });
    });
  }

  void enqueue(Message message)
  {
    m_queuedBytes += message.bytes->size();
    m_queue.push_back(std::move(message));
    // The oldest go first, never the one being written, never the newest.
    const std::size_t firstDroppable = m_writing ? 1 : 0;
    while (m_queuedBytes > m_options.maxQueueBytes && m_queue.size() > firstDroppable + 1)
    {
      auto oldest = m_queue.begin() + firstDroppable;
      m_queuedBytes -= oldest->bytes->size();
      m_queue.erase(oldest);
      ++droppedMessages;
    }
  }

  void pump()
  {
    if (!m_connected || m_writing || m_queue.empty())
    {
      return;
    }
    m_writing = true;
    const auto generation = m_generation;
    const auto message = m_queue.front();
    withStream([&](auto& ws) {
      ws.binary(message.binary);
      ws.async_write(net::buffer(*message.bytes),
        [self = shared_from_this(), generation, message](const boost::system::error_code& ec, std::size_t n) {
          if (generation != self->m_generation) return;
          self->m_writing = false;
          if (ec) return self->retry("write", ec);
          self->m_queuedBytes -= message.bytes->size();
          self->m_queue.pop_front();
          self->sentBytes += n;
          self->pump();
        });
    });
  }

  // Drops this connection and tries again after a while, longer each time.
  // What was queued, including a message cut off mid-write, is kept.
  void retry(const char* where, const boost::system::error_code& ec, const std::string& problem = "")
  {
    if (m_stopping)
    {
      return;
    }
    const auto generation = ++m_generation;
    m_connected = false;
    m_writing = false;
    closeStream();
    ++reconnects;
    status("reconnecting", std::string(where) + ": " + (problem.empty() ? ec.message() : problem));

    m_timer.expires_after(m_retryAfter);
    m_retryAfter = std::min<std::chrono::milliseconds>(m_retryAfter * 2, kLastRetry);
    m_timer.async_wait([self = shared_from_this(), generation](const boost::system::error_code& ec) {
      if (ec || generation != self->m_generation) return;
      self->connect();
    });
  }

  void closeStream()
  {
    withStream([](auto& ws) {
      boost::system::error_code ec;
      beast::get_lowest_layer(ws).socket().close(ec);
    });
  }

  Options m_options;
  net::strand<net::io_context::executor_type> m_strand;
  tcp::resolver m_resolver;
  net::steady_timer m_timer;
  ssl::context m_ssl;
  std::variant<std::monostate, std::unique_ptr<Plain>, std::unique_ptr<Secure>> m_ws;
  beast::flat_buffer m_readBuffer;

  std::deque<Message> m_queue;
  std::size_t m_queuedBytes = 0;
  bool m_connected = false;
  bool m_writing = false;
  bool m_stopping = false;
  // Bumped whenever a connection is abandoned, so a handler from an earlier one
  // that completes late does nothing.
  std::uint64_t m_generation = 0;
  std::chrono::milliseconds m_retryAfter = kFirstRetry;
};

// ── The service ─────────────────────────────────────────────────────────────

WebsocketWriter::WebsocketWriter(const std::string& instanceId)
  : Service(instanceId, serviceId())
{
  // Connecting is something a board switches on.
  m_bypass = true;
}

WebsocketWriter::~WebsocketWriter()
{
  // Quietly: the runtime a notification would go through may be on its way
  // out too.
  stop(false);
}

json WebsocketWriter::configure(Data data)
{
  if (auto buf = getJSONFromData(data))
  {
    const auto& j = *buf;
    const auto before = std::make_tuple(m_url, m_path, m_mount, m_headers, m_maxQueueBytes, m_host, m_port);
    const bool wasRunning = !isBypass();
    const auto text = [&j](const char* key, std::string& into) {
      if (j.contains(key) && j[key].is_string())
      {
        into = j[key].get<std::string>();
      }
    };
    text("url", m_url);
    text("path", m_path);
    text(MOUNT_FIELD, m_mount);
    text("host", m_host);
    // Boards have written the port as a string and as a number.
    if (j.contains("port"))
    {
      m_port = j["port"].is_string() ? j["port"].get<std::string>()
             : j["port"].is_number() ? std::to_string(j["port"].get<long long>())
                                     : m_port;
    }
    if (j.contains("headers") && j["headers"].is_object())
    {
      m_headers = j["headers"];
    }
    if (j.contains("maxQueueBytes") && j["maxQueueBytes"].is_number_integer()
        && j["maxQueueBytes"].get<long long>() > 0)
    {
      m_maxQueueBytes = j["maxQueueBytes"].get<std::size_t>();
    }

    // Bypass last, so a payload carrying an address and bypass:false together
    // connects once, to that address.
    Service::configure(data);
    if (wasRunning && !isBypass()
        && before != std::make_tuple(m_url, m_path, m_mount, m_headers, m_maxQueueBytes, m_host, m_port))
    {
      restart();
    }
    return getState();
  }
  return Service::configure(data);
}

bool WebsocketWriter::onBypassChanged(bool bypass)
{
  if (bypass)
  {
    stop();
  }
  else
  {
    restart();
  }
  return bypass;
}

std::optional<WebsocketTarget> WebsocketWriter::target(std::string& why) const
{
  const auto fromMount = [this, &why]() -> std::optional<WebsocketTarget> {
    auto parsed = parseWebsocketTarget(joinMountPath(m_mount, m_path));
    if (!parsed)
    {
      why = "not a WebSocket address: " + m_mount;
    }
    return parsed;
  };

  if (!m_url.empty())
  {
    if (isMountReference(m_url))
    {
      if (!m_mount.empty() && !isMountReference(m_mount))
      {
        return fromMount();
      }
      why = "waiting for the address of " + m_url;
      return std::nullopt;
    }
    auto parsed = parseWebsocketTarget(m_url);
    if (!parsed)
    {
      why = "not a ws://, wss:// or http(s):// URL: " + m_url;
    }
    return parsed;
  }
  if (!m_mount.empty())
  {
    if (isMountReference(m_mount))
    {
      why = "waiting for the address of " + m_mount;
      return std::nullopt;
    }
    return fromMount();
  }
  if (!m_host.empty() && !m_port.empty())
  {
    const auto path = m_path.empty() || m_path.front() != '/' ? "/" + m_path : m_path;
    return parseWebsocketTarget("ws://" + m_host + ":" + m_port + path);
  }
  why = "no url";
  return std::nullopt;
}

void WebsocketWriter::restart()
{
  stop();
  std::string why;
  const auto destination = target(why);
  if (!destination)
  {
    onStatus("waiting", why);
    return;
  }

  Link::Options options;
  options.target = *destination;
  options.headers = m_headers;
  options.maxQueueBytes = m_maxQueueBytes;
  options.host = parentHost();
  // The hello hkp-rt's websocket-server pairs a writer by; only boards written
  // for it — the host/port/path form — expect one.
  if (m_url.empty() && m_mount.empty())
  {
    options.hello = json{{"id", "writer"}, {"type", "writer"}}.dump();
  }
  options.onStatus = [this](const std::string& status, const std::string& error) {
    onStatus(status, error);
  };

  m_ioc.restart();
  m_work.emplace(m_ioc.get_executor());
  m_link = std::make_shared<Link>(m_ioc, std::move(options));
  m_link->start();
  m_thread = std::thread([this]() { m_ioc.run(); });
}

void WebsocketWriter::stop(bool notify)
{
  if (!m_link)
  {
    return;
  }
  m_link->stop();
  m_work.reset();
  if (m_thread.joinable())
  {
    m_thread.join();
  }
  m_link.reset();
  if (notify)
  {
    onStatus("idle", "");
  }
}

void WebsocketWriter::onStatus(const std::string& status, const std::string& error)
{
  {
    std::lock_guard<std::mutex> lock(m_statusMutex);
    if (status == m_status && error == m_error)
    {
      return;
    }
    m_status = status;
    m_error = error;
  }
  sendNotification(json{{"status", status}, {"error", error}});
}

Data WebsocketWriter::process(Data data)
{
  if (!m_link)
  {
    return data;
  }

  Link::Message message;
  if (auto bytes = boost::get<BinaryData>(&data))
  {
    message.bytes = std::make_shared<const std::string>(bytes->begin(), bytes->end());
  }
  else if (auto mixed = boost::get<MixedData>(&data))
  {
    message.bytes = std::make_shared<const std::string>(mixed->binary.begin(), mixed->binary.end());
  }
  else if (auto text = boost::get<std::string>(&data))
  {
    message.bytes = std::make_shared<const std::string>(*text);
    message.binary = false;
  }
  else if (auto value = boost::get<json>(&data))
  {
    message.bytes = std::make_shared<const std::string>(value->dump());
    message.binary = false;
  }
  else if (auto ring = getRingBufferFromData(data))
  {
    // As before this service was rebuilt: the samples waiting, serialised.
    ring->resyncIfNeeded();
    const auto serialised = ring->serialise();
    message.bytes = std::make_shared<const std::string>(serialised.data.get(), serialised.size);
  }
  if (message.bytes && !message.bytes->empty())
  {
    m_link->send(std::move(message));
  }
  return data;
}

json WebsocketWriter::getState() const
{
  json state = {
    {"url", m_url},
    {"path", m_path},
    {MOUNT_FIELD, m_mount},
    {"headers", m_headers},
    {"maxQueueBytes", m_maxQueueBytes},
  };
  if (!m_host.empty() || !m_port.empty())
  {
    state["host"] = m_host;
    state["port"] = m_port;
  }
  {
    std::lock_guard<std::mutex> lock(m_statusMutex);
    state["status"] = m_status;
    state["error"] = m_error;
  }
  std::string why;
  const auto destination = target(why);
  state["target"] = destination ? destination->url() : std::string();
  if (m_link)
  {
    state["sentBytes"] = m_link->sentBytes.load();
    state["droppedMessages"] = m_link->droppedMessages.load();
    state["reconnects"] = m_link->reconnects.load();
  }
  return mergeStateWith(state);
}

} // namespace hkp
