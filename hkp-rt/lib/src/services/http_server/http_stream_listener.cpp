#include "./http_stream_listener.h"

#include <cmath>
#include <string_view>

#include <boost/asio.hpp>
#include <boost/beast.hpp>

#include "./http_session.h"

namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace hkp {

namespace {

// What the kernel may hold for one listener on top of its queue. Kept small:
// audio sitting in a socket buffer is audio the listener hears late, and only
// what is still in the queue can be dropped to bring it back to the live edge.
// About a second at 128 kbit/s.
constexpr int kSendBufferBytes = 16 * 1024;

} // namespace

HttpStreamListener::HttpStreamListener(std::shared_ptr<Session> session, std::size_t maxQueueBytes,
                                       std::chrono::milliseconds stallTimeout,
                                       std::function<void(HttpStreamListener*)> onClosed)
  : m_session(std::move(session))
  , m_queue(maxQueueBytes)
  , m_onClosed(std::move(onClosed))
  , m_stallTimeout(stallTimeout)
{
}

void HttpStreamListener::start(const std::string& contentType)
{
  auto& stream = m_session->tcpStream();
  // The request's read timeout must not end a response that is meant to last.
  stream.expires_never();
  // Chunks are small and due now; waiting to fill a segment only adds latency.
  boost::system::error_code ec;
  stream.socket().set_option(tcp::no_delay(true), ec);
  stream.socket().set_option(net::socket_base::send_buffer_size(kSendBufferBytes), ec);

  m_connectedAt = std::chrono::steady_clock::now();
  const auto remote = stream.socket().remote_endpoint(ec);
  if (!ec)
  {
    m_address = remote.address().to_string() + ":" + std::to_string(remote.port());
  }
  m_userAgent = m_session->getRequestHeader("user-agent");
  m_range = m_session->getRequestHeader("range");

  m_head = "HTTP/1.1 200 OK\r\n"
           "Content-Type: " + contentType + "\r\n"
           "Cache-Control: no-cache, no-store\r\n"
           "Access-Control-Allow-Origin: *\r\n"
           "Connection: close\r\n"
           "\r\n";
  pump();
  watchForHangUp();
}

void HttpStreamListener::deliver(const StreamChunk& chunk)
{
  net::post(m_session->tcpStream().get_executor(), [self = shared_from_this(), chunk]() {
    if (self->m_closed)
    {
      return;
    }
    // Checked as chunks arrive, which is exactly when a stalled listener
    // matters: a stream that has stopped strands nobody.
    const bool writing = self->m_headWriting || self->m_queue.writing();
    if (writing && std::chrono::steady_clock::now() - self->m_writeStartedAt > self->m_stallTimeout)
    {
      return self->finish();
    }
    self->m_dropped += self->m_queue.push(chunk);
    self->pump();
  });
}

void HttpStreamListener::pump()
{
  if (m_closed)
  {
    return;
  }
  auto& socket = m_session->tcpStream().socket();

  if (!m_headSent)
  {
    if (m_headWriting)
    {
      return;
    }
    m_headWriting = true;
    m_writeStartedAt = std::chrono::steady_clock::now();
    net::async_write(socket, net::buffer(m_head),
      [self = shared_from_this()](const boost::system::error_code& ec, std::size_t) {
        self->m_headWriting = false;
        if (ec)
        {
          return self->finish();
        }
        self->m_headSent = true;
        self->pump();
      });
    return;
  }

  auto chunk = m_queue.beginWrite();
  if (!chunk)
  {
    return;
  }
  // The handler holds the chunk, so the bytes outlive the write even if the
  // queue drops it meanwhile.
  m_writeStartedAt = std::chrono::steady_clock::now();
  net::async_write(socket, net::buffer(*chunk),
    [self = shared_from_this(), chunk](const boost::system::error_code& ec, std::size_t written) {
      self->m_queue.endWrite();
      if (ec)
      {
        return self->finish();
      }
      self->m_bytesSent += written;
      self->pump();
    });
}

nlohmann::json HttpStreamListener::describe() const
{
  const auto connected = std::chrono::duration<double>(std::chrono::steady_clock::now() - m_connectedAt);
  nlohmann::json description = {
    {"address", m_address},
    {"userAgent", m_userAgent},
    {"seconds", std::round(connected.count() * 10.0) / 10.0},
    {"bytesSent", m_bytesSent.load()},
    {"droppedChunks", m_dropped.load()},
  };
  if (!m_range.empty())
  {
    description["range"] = m_range;
  }
  return description;
}

void HttpStreamListener::watchForHangUp()
{
  // A listener sends nothing after its request, so the only thing a read can
  // finish with is the caller going away — which then shows at once, rather
  // than at the next write.
  m_session->tcpStream().socket().async_read_some(net::buffer(m_readBuffer),
    [self = shared_from_this()](const boost::system::error_code& ec, std::size_t) {
      if (ec)
      {
        return self->finish();
      }
      self->watchForHangUp();
    });
}

void HttpStreamListener::finish()
{
  if (m_closed)
  {
    return;
  }
  m_closed = true;
  boost::system::error_code ec;
  m_session->tcpStream().socket().close(ec);
  if (auto onClosed = std::move(m_onClosed))
  {
    onClosed(this);
  }
}

void HttpStreamListener::close()
{
  // Reached from StreamBroadcast::closeAll once the listener has left, from
  // whichever thread ended the stream. While the server runs, closing belongs
  // on the connection's strand like everything else; once its thread has
  // stopped nothing runs there, and a posted close would wait for a restart
  // that may never come, so the socket is closed here.
  const auto executor = m_session->tcpStream().get_executor();
  auto& context = static_cast<net::io_context&>(net::query(executor, net::execution::context));
  if (!context.stopped())
  {
    net::post(executor, [self = shared_from_this()]() {
      self->m_onClosed = nullptr;
      self->finish();
    });
    return;
  }
  m_closed = true;
  m_onClosed = nullptr;
  boost::system::error_code ec;
  m_session->tcpStream().socket().close(ec);
}

std::optional<std::pair<std::uint64_t, std::uint64_t>> boundedRange(const std::string& header)
{
  constexpr std::string_view prefix = "bytes=";
  if (header.rfind(prefix, 0) != 0)
  {
    return std::nullopt;
  }
  const auto spec = header.substr(prefix.size());
  const auto dash = spec.find('-');
  if (dash == std::string::npos || dash == 0 || dash + 1 >= spec.size()
      || spec.find_first_not_of("0123456789-") != std::string::npos
      || spec.find('-', dash + 1) != std::string::npos)
  {
    return std::nullopt;
  }
  const auto first = std::stoull(spec.substr(0, dash));
  const auto last = std::stoull(spec.substr(dash + 1));
  if (last < first)
  {
    return std::nullopt;
  }
  return std::make_pair(first, last);
}

void answerRangeProbe(const std::shared_ptr<Session>& session, const std::string& contentType,
                      std::uint64_t first, std::uint64_t last, const std::vector<uint8_t>& sample)
{
  const auto length = std::min<std::uint64_t>(last - first + 1, sample.size());
  auto response = std::make_shared<std::string>(
    "HTTP/1.1 206 Partial Content\r\n"
    "Content-Type: " + contentType + "\r\n"
    "Content-Range: bytes " + std::to_string(first) + "-" + std::to_string(first + length - 1) + "/*\r\n"
    "Content-Length: " + std::to_string(length) + "\r\n"
    "Cache-Control: no-cache, no-store\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Connection: close\r\n"
    "\r\n");
  response->append(reinterpret_cast<const char*>(sample.data()), length);

  auto& socket = session->tcpStream().socket();
  session->tcpStream().expires_never();
  net::async_write(socket, net::buffer(*response),
    [session, response](const boost::system::error_code&, std::size_t) {
      boost::system::error_code ec;
      session->tcpStream().socket().shutdown(tcp::socket::shutdown_both, ec);
      session->tcpStream().socket().close(ec);
    });
}

} // namespace hkp
