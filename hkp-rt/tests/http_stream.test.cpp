#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <string>
#include <thread>

#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/read.hpp>
#include <boost/asio/write.hpp>

#include <types/data.h>
#include "services/http_server/http_server_subservices.h"
#include "services/http_server/http_stream_listener.h"

using namespace hkp;
namespace net = boost::asio;
using tcp = net::ip::tcp;

// ──────────────────────────────────────────────────────────────────────────────
// An endpoint's stream: callers on the stream path stay connected and receive
// what every pass produces, as it happens.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

template <typename Predicate>
bool eventually(Predicate predicate)
{
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(3);
  while (std::chrono::steady_clock::now() < deadline)
  {
    if (predicate())
    {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
  }
  return predicate();
}

// A caller on the other end of a socket, reading with a deadline.
class Caller
{
public:
  Caller(unsigned short port, const std::string& path, const std::string& headers = "",
         int receiveBufferBytes = 0)
    : m_socket(m_ioc)
  {
    m_socket.open(tcp::v4());
    if (receiveBufferBytes > 0)
    {
      m_socket.set_option(net::socket_base::receive_buffer_size(receiveBufferBytes));
    }
    m_socket.connect(tcp::endpoint(net::ip::make_address("127.0.0.1"), port));
    const std::string request =
      "GET " + path + " HTTP/1.1\r\nHost: localhost\r\n" + headers + "\r\n";
    net::write(m_socket, net::buffer(request));
  }

  // Reads until `count` bytes beyond what was read before have arrived, or
  // the deadline; answers everything received so far.
  const std::string& readAtLeast(std::size_t count)
  {
    const auto target = m_received.size() + count;
    eventually([&]() {
      boost::system::error_code ec;
      const auto available = m_socket.available(ec);
      if (ec)
      {
        return true;
      }
      if (available > 0)
      {
        std::string chunk(available, '\0');
        const auto n = m_socket.read_some(net::buffer(chunk), ec);
        m_received.append(chunk.data(), n);
      }
      return m_received.size() >= target;
    });
    return m_received;
  }

  // The bytes after the response head.
  std::string body() const
  {
    const auto end = m_received.find("\r\n\r\n");
    return end == std::string::npos ? std::string() : m_received.substr(end + 4);
  }

  // Whether the server has closed the connection.
  bool closedByServer()
  {
    return eventually([&]() {
      char buffer[4096];
      boost::system::error_code ec;
      m_socket.non_blocking(true);
      const auto n = m_socket.read_some(net::buffer(buffer), ec);
      m_received.append(buffer, n);
      return ec && ec != net::error::would_block;
    });
  }

  void hangUp()
  {
    boost::system::error_code ec;
    m_socket.close(ec);
  }

  const std::string& received() const { return m_received; }

private:
  net::io_context m_ioc;
  tcp::socket m_socket;
  std::string m_received;
};

std::size_t listeners(const HttpServerSubservices& server)
{
  return server.getState().value("listeners", std::size_t{0});
}

Data bytes(const std::string& text)
{
  return Data(BinaryData(text.begin(), text.end()));
}

unsigned short startStreaming(HttpServerSubservices& server, json stream)
{
  server.configure(Data(json{{"port", 0}, {"stream", stream}, {"bypass", false}}));
  const auto port = server.getState().value("port", 0);
  REQUIRE(port != 0);
  return static_cast<unsigned short>(port);
}

} // namespace

TEST_CASE("a caller on the stream path gets a head, then every pass",
          "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live.mp3"}, {"contentType", "audio/mpeg"}});

  Caller caller(port, "/live.mp3");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));

  server.process(bytes("abc"));
  server.process(bytes("def"));

  REQUIRE(eventually([&]() { caller.readAtLeast(0); return caller.body() == "abcdef"; }));
  const auto& received = caller.received();
  REQUIRE(received.rfind("HTTP/1.1 200 OK\r\n", 0) == 0);
  REQUIRE(received.find("Content-Type: audio/mpeg\r\n") != std::string::npos);
  // No length: the body is the stream and ends with the connection.
  REQUIRE(received.find("Content-Length") == std::string::npos);
  REQUIRE(received.find("Transfer-Encoding") == std::string::npos);
}

TEST_CASE("every caller gets the same stream", "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "live"}});

  Caller first(port, "/live");
  Caller second(port, "/live");
  REQUIRE(eventually([&]() { return listeners(server) == 2; }));

  for (const auto* piece : {"one ", "two ", "three"})
  {
    server.process(bytes(piece));
  }

  REQUIRE(eventually([&]() { first.readAtLeast(0); return first.body() == "one two three"; }));
  REQUIRE(eventually([&]() { second.readAtLeast(0); return second.body() == "one two three"; }));
}

TEST_CASE("a late caller starts with the burst, then the live stream",
          "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}, {"burstBytes", 8}});

  server.process(bytes("0000"));
  server.process(bytes("1111"));
  server.process(bytes("2222"));

  Caller late(port, "/live");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));
  server.process(bytes("3333"));

  REQUIRE(eventually([&]() { late.readAtLeast(0); return late.body() == "111122223333"; }));
}

TEST_CASE("a caller hanging up leaves the stream", "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}});

  Caller caller(port, "/live");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));
  caller.hangUp();

  REQUIRE(eventually([&]() { return listeners(server) == 0; }));
}

TEST_CASE("other paths do not join the stream", "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}});

  Caller elsewhere(port, "/status");
  Caller listening(port, "/live");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));
  std::this_thread::sleep_for(std::chrono::milliseconds(50));
  REQUIRE(listeners(server) == 1);
}

TEST_CASE("stopping the server lets its listeners go", "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}});

  Caller caller(port, "/live");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));

  server.configure(Data(json{{"bypass", true}}));
  REQUIRE(listeners(server) == 0);
  REQUIRE(caller.closedByServer());
}

TEST_CASE("ending the stream lets its listeners go", "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}});

  Caller caller(port, "/live");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));

  server.configure(Data(json{{"stream", nullptr}}));
  REQUIRE_FALSE(server.getState().contains("stream"));
  REQUIRE(caller.closedByServer());
}

TEST_CASE("the stream is reported, so a board saves it", "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  server.configure(Data(json{{"stream", {{"path", "/live.mp3"}, {"contentType", "audio/mpeg"}}}}));

  const auto state = server.getState();
  REQUIRE(state["stream"]["path"] == "/live.mp3");
  REQUIRE(state["stream"]["contentType"] == "audio/mpeg");
  REQUIRE(state["stream"]["burstBytes"] == 0);
  REQUIRE(state["listeners"] == 0);
}

TEST_CASE("a caller that stops reading stops counting as a listener",
          "[http-server-subservices][stream]")
{
  // A paused player, or a request a browser parked instead of closing: the
  // connection stays open, but nothing is being heard.
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}, {"stallTimeoutMs", 200}});

  Caller reading(port, "/live");
  Caller parked(port, "/live", "", 4096);
  REQUIRE(eventually([&]() { return listeners(server) == 2; }));

  const std::string chunk(4096, 'x');
  const bool dropped = eventually([&]() {
    server.process(bytes(chunk));
    reading.readAtLeast(0);
    return listeners(server) == 1;
  });
  REQUIRE(dropped);

  // The one still reading is the one still listening.
  const auto before = reading.received().size();
  server.process(bytes("more"));
  REQUIRE(eventually([&]() { return reading.readAtLeast(0).size() > before; }));
}

TEST_CASE("who is listening is reported, not only how many",
          "[http-server-subservices][stream]")
{
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}});

  Caller caller(port, "/live", "User-Agent: test-player/1.0\r\nRange: bytes=0-\r\n");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));
  server.process(bytes("abc"));
  REQUIRE(eventually([&]() { caller.readAtLeast(0); return caller.body() == "abc"; }));

  const auto details = server.getState()["listenerDetails"];
  REQUIRE(details.size() == 1);
  REQUIRE(details[0]["userAgent"] == "test-player/1.0");
  REQUIRE(details[0]["range"] == "bytes=0-");
  REQUIRE(details[0]["address"].get<std::string>().rfind("127.0.0.1:", 0) == 0);
  REQUIRE(eventually([&]() { return server.getState()["listenerDetails"][0]["bytesSent"] == 3; }));
}

TEST_CASE("only a bounded byte range is a probe", "[http-server-subservices][stream][range]")
{
  REQUIRE(boundedRange("bytes=0-1") == std::make_pair(std::uint64_t{0}, std::uint64_t{1}));
  REQUIRE(boundedRange("bytes=10-20") == std::make_pair(std::uint64_t{10}, std::uint64_t{20}));
  // Open-ended is what a player streaming from the start asks for.
  REQUIRE_FALSE(boundedRange("bytes=0-"));
  REQUIRE_FALSE(boundedRange("bytes=-500"));
  REQUIRE_FALSE(boundedRange("bytes=0-1,5-6"));
  REQUIRE_FALSE(boundedRange("bytes=5-1"));
  REQUIRE_FALSE(boundedRange(""));
  // The largest offsets that fit are still a range; past that it is malformed
  // rather than an exception.
  REQUIRE(boundedRange("bytes=1-18446744073709551615"));
  REQUIRE_FALSE(boundedRange("bytes=0-18446744073709551616"));
  REQUIRE_FALSE(boundedRange("bytes=99999999999999999999999999-999999999999999999999999999"));
  // Every byte there could be: a length one more than can be counted.
  REQUIRE_FALSE(boundedRange("bytes=0-18446744073709551615"));
}

TEST_CASE("a range probe is answered and closed, not kept as a listener",
          "[http-server-subservices][stream][range]")
{
  // What WebKit sends before playing: two bytes, to learn what the resource is.
  HttpServerSubservices server("radio");
  const auto port = startStreaming(server, json{{"path", "/live"}, {"contentType", "audio/mpeg"}});
  server.process(bytes("\xFF\xFB" "rest-of-frame"));

  Caller probe(port, "/live", "Range: bytes=0-1\r\n");
  REQUIRE(probe.closedByServer());
  const auto& response = probe.received();
  REQUIRE(response.rfind("HTTP/1.1 206 Partial Content\r\n", 0) == 0);
  REQUIRE(response.find("Content-Range: bytes 0-1/*\r\n") != std::string::npos);
  REQUIRE(response.find("Content-Length: 2\r\n") != std::string::npos);
  REQUIRE(probe.body() == "\xFF\xFB");
  REQUIRE(listeners(server) == 0);

  // An open-ended range is a player streaming, and is one.
  Caller player(port, "/live", "Range: bytes=0-\r\n");
  REQUIRE(eventually([&]() { return listeners(server) == 1; }));
}
