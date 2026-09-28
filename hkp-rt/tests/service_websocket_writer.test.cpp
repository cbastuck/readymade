#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/websocket.hpp>

#include <types/data.h>
#include "services/websocket_writer.h"

using namespace hkp;

namespace {

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;

template <typename Predicate>
bool eventually(Predicate predicate, std::chrono::milliseconds within = std::chrono::seconds(5))
{
  const auto deadline = std::chrono::steady_clock::now() + within;
  while (std::chrono::steady_clock::now() < deadline)
  {
    if (predicate())
    {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
  }
  return predicate();
}

// A WebSocket server that keeps what it is sent: one blocking thread per
// connection, which is plenty for a test and keeps it readable.
class Receiver
{
public:
  struct Message
  {
    bool binary;
    std::string bytes;
  };

  explicit Receiver(unsigned short port = 0)
    : m_acceptor(m_ioc, {net::ip::make_address("127.0.0.1"), port})
  {
    m_acceptor.set_option(net::socket_base::reuse_address(true));
    m_accepting = std::thread([this]() { accept(); });
  }

  ~Receiver()
  {
    boost::system::error_code ec;
    m_acceptor.close(ec);
    dropAll();
    m_accepting.join();
    for (auto& thread : m_serving)
    {
      thread.join();
    }
  }

  unsigned short port() const { return m_acceptor.local_endpoint().port(); }

  std::vector<Message> messages()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_messages;
  }

  std::vector<std::string> targets()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_targets;
  }

  std::vector<std::string> authorizations()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_authorizations;
  }

  std::size_t connections() const { return m_connections.load(); }

  // Hangs up on everyone connected, the way a server restarting does.
  void dropAll()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto* socket : m_sockets)
    {
      boost::system::error_code ec;
      socket->shutdown(tcp::socket::shutdown_both, ec);
    }
  }

private:
  void accept()
  {
    for (;;)
    {
      tcp::socket socket(m_ioc);
      boost::system::error_code ec;
      m_acceptor.accept(socket, ec);
      if (ec)
      {
        return;
      }
      std::lock_guard<std::mutex> lock(m_mutex);
      m_serving.emplace_back([this, socket = std::move(socket)]() mutable { serve(std::move(socket)); });
    }
  }

  void serve(tcp::socket socket)
  {
    boost::system::error_code ec;
    beast::flat_buffer buffer;
    http::request<http::string_body> request;
    http::read(socket, buffer, request, ec);
    if (ec)
    {
      return;
    }
    websocket::stream<tcp::socket> ws(std::move(socket));
    ws.accept(request, ec);
    if (ec)
    {
      return;
    }
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      m_targets.emplace_back(request.target());
      m_authorizations.emplace_back(request[http::field::authorization]);
      m_sockets.push_back(&ws.next_layer());
    }
    ++m_connections;
    for (;;)
    {
      beast::flat_buffer message;
      ws.read(message, ec);
      if (ec)
      {
        break;
      }
      std::lock_guard<std::mutex> lock(m_mutex);
      m_messages.push_back({ws.got_binary(), beast::buffers_to_string(message.data())});
    }
    std::lock_guard<std::mutex> lock(m_mutex);
    m_sockets.erase(std::find(m_sockets.begin(), m_sockets.end(), &ws.next_layer()));
  }

  net::io_context m_ioc;
  tcp::acceptor m_acceptor;
  std::thread m_accepting;
  std::vector<std::thread> m_serving;
  std::mutex m_mutex;
  std::vector<tcp::socket*> m_sockets;
  std::vector<Message> m_messages;
  std::vector<std::string> m_targets;
  std::vector<std::string> m_authorizations;
  std::atomic<std::size_t> m_connections{0};
};

Data bytes(const std::string& text)
{
  return Data(BinaryData(text.begin(), text.end()));
}

std::string url(unsigned short port, const std::string& path = "/live.mp3")
{
  return "ws://127.0.0.1:" + std::to_string(port) + path;
}

std::string status(const WebsocketWriter& writer)
{
  return writer.getState().value("status", std::string());
}

} // namespace

TEST_CASE("a WebSocket address is read from ws, wss and http(s) URLs",
          "[websocket-writer][target]")
{
  auto plain = parseWebsocketTarget("ws://relay.example:8080/hosted/abc/live.mp3");
  REQUIRE(plain);
  REQUIRE_FALSE(plain->secure);
  REQUIRE(plain->host == "relay.example");
  REQUIRE(plain->port == "8080");
  REQUIRE(plain->path == "/hosted/abc/live.mp3");

  // An endpoint's http(s) address means the WebSocket at the same place.
  auto secure = parseWebsocketTarget("https://relay.example/hosted/abc/live.mp3?key=k");
  REQUIRE(secure);
  REQUIRE(secure->secure);
  REQUIRE(secure->port == "443");
  REQUIRE(secure->path == "/hosted/abc/live.mp3?key=k");
  REQUIRE(secure->url() == "wss://relay.example:443/hosted/abc/live.mp3?key=k");

  REQUIRE(parseWebsocketTarget("ws://relay.example")->path == "/");
  REQUIRE_FALSE(parseWebsocketTarget("hkp-mount://relay/radio"));
  REQUIRE_FALSE(parseWebsocketTarget("ftp://relay.example/x"));
  REQUIRE_FALSE(parseWebsocketTarget("ws:///no-host"));
}

TEST_CASE("each pass is sent as one message, in order, and handed on unchanged",
          "[websocket-writer]")
{
  Receiver receiver;
  WebsocketWriter writer("push");
  writer.configure(Data(json{{"url", url(receiver.port())}, {"bypass", false}}));
  REQUIRE(eventually([&]() { return status(writer) == "connected"; }));

  const auto out = writer.process(bytes("one"));
  REQUIRE(getBinaryFromData(out) == BinaryData{'o', 'n', 'e'});
  writer.process(bytes("two"));
  writer.process(Data(json{{"note", "text"}}));

  REQUIRE(eventually([&]() { return receiver.messages().size() == 3; }));
  const auto messages = receiver.messages();
  REQUIRE(messages[0].binary);
  REQUIRE(messages[0].bytes == "one");
  REQUIRE(messages[1].bytes == "two");
  REQUIRE_FALSE(messages[2].binary);
  REQUIRE(messages[2].bytes == R"({"note":"text"})");
  REQUIRE(receiver.targets().front() == "/live.mp3");
  REQUIRE(writer.getState()["sentBytes"] == 3 + 3 + 15);
}

TEST_CASE("headers go on the handshake", "[websocket-writer]")
{
  Receiver receiver;
  WebsocketWriter writer("push");
  writer.configure(Data(json{
    {"url", url(receiver.port())},
    {"headers", {{"Authorization", "Bearer let-me-broadcast"}}},
    {"bypass", false}}));
  REQUIRE(eventually([&]() { return receiver.connections() == 1; }));
  REQUIRE(receiver.authorizations().front() == "Bearer let-me-broadcast");
}

TEST_CASE("a dropped connection is made again", "[websocket-writer]")
{
  Receiver receiver;
  WebsocketWriter writer("push");
  writer.configure(Data(json{{"url", url(receiver.port())}, {"bypass", false}}));
  REQUIRE(eventually([&]() { return receiver.connections() == 1; }));

  receiver.dropAll();
  REQUIRE(eventually([&]() { return receiver.connections() == 2; }));
  REQUIRE(eventually([&]() { return status(writer) == "connected"; }));

  writer.process(bytes("after"));
  REQUIRE(eventually([&]() {
    const auto messages = receiver.messages();
    return !messages.empty() && messages.back().bytes == "after";
  }));
  REQUIRE(writer.getState()["reconnects"].get<int>() >= 1);
}

TEST_CASE("while nobody is there, only the newest is kept", "[websocket-writer]")
{
  // Nothing listens on this port yet.
  unsigned short port = 0;
  {
    Receiver probe;
    port = probe.port();
  }
  WebsocketWriter writer("push");
  writer.configure(Data(json{{"url", url(port)}, {"maxQueueBytes", 8}, {"bypass", false}}));
  for (const auto* piece : {"0000", "1111", "2222", "3333"})
  {
    writer.process(bytes(piece));
  }
  REQUIRE(eventually([&]() { return writer.getState()["droppedMessages"] == 2; }));

  // What was kept goes out once there is somewhere to send it.
  Receiver receiver(port);
  REQUIRE(eventually([&]() { return receiver.messages().size() == 2; }, std::chrono::seconds(15)));
  REQUIRE(receiver.messages()[0].bytes == "2222");
  REQUIRE(receiver.messages()[1].bytes == "3333");
}

TEST_CASE("a mount reference waits for its address, then connects to it with the path",
          "[websocket-writer][mount]")
{
  Receiver receiver;
  WebsocketWriter writer("push");
  writer.configure(Data(json{
    {"url", "hkp-mount://relay/radio"}, {"path", "/live.mp3"}, {"bypass", false}}));
  REQUIRE(status(writer) == "waiting");
  REQUIRE(writer.getState()["error"].get<std::string>().find("hkp-mount://relay/radio") != std::string::npos);

  // What the board's coordinator writes once the relay has published.
  writer.configure(Data(json{
    {"__hkpMount", "http://127.0.0.1:" + std::to_string(receiver.port()) + "/hosted/abc"}}));
  REQUIRE(eventually([&]() { return receiver.connections() == 1; }));
  REQUIRE(receiver.targets().front() == "/hosted/abc/live.mp3");
  // The reference is what the board keeps.
  REQUIRE(writer.getState()["url"] == "hkp-mount://relay/radio");
}

TEST_CASE("a board written the old way still opens with the writer hello",
          "[websocket-writer][legacy]")
{
  Receiver receiver;
  WebsocketWriter writer("push");
  writer.configure(Data(json{
    {"host", "127.0.0.1"}, {"port", std::to_string(receiver.port())}, {"path", "/stream"},
    {"bypass", false}}));
  writer.process(bytes("data"));
  REQUIRE(eventually([&]() { return receiver.messages().size() == 2; }));
  REQUIRE(receiver.targets().front() == "/stream");
  REQUIRE(json::parse(receiver.messages()[0].bytes)["type"] == "writer");
  REQUIRE(receiver.messages()[1].bytes == "data");
}

TEST_CASE("bypassed, it connects nowhere and passes everything on",
          "[websocket-writer]")
{
  WebsocketWriter writer("push");
  writer.configure(Data(json{{"url", "ws://127.0.0.1:1/x"}}));
  REQUIRE(status(writer) == "idle");
  const auto out = writer.process(bytes("x"));
  REQUIRE(getBinaryFromData(out) == BinaryData{'x'});
}
