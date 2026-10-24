#pragma once

#include <array>
#include <chrono>
#include <map>
#include <memory>
#include <string>
#include <thread>

#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/read.hpp>
#include <boost/asio/read_until.hpp>
#include <boost/asio/streambuf.hpp>
#include <boost/asio/write.hpp>

#include <catch2/catch_test_macros.hpp>
#include <crow.h>

#include <app.h>
#include <server.h>

// A runtime server listening on a loopback port, and what it answers, for
// tests that send it real requests (server_origins.test.cpp,
// secret_canary.test.cpp).

namespace listening
{

using namespace hkp;
using boost::asio::ip::tcp;

struct Reply
{
  int status = 0; // 0: the connection closed without an answer
  std::map<std::string, std::string> headers; // names lower-cased
  std::string body;

  bool has(const std::string& name) const { return headers.count(name) > 0; }
};

std::string lowered(std::string value)
{
  for (auto& c : value)
  {
    c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  }
  return value;
}

unsigned short freePort()
{
  boost::asio::io_context io;
  tcp::acceptor acceptor(io, tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), 0));
  return acceptor.local_endpoint().port();
}

// A server on a loopback port, listening for as long as this lives.
class Listening
{
public:
  explicit Listening(const std::string& allowedOrigins, AuthConfig auth = {})
    : m_app(std::make_shared<App>())
    , m_server(std::make_shared<Server>(m_app, "test-rt", allowedOrigins, "", std::move(auth)))
    , m_port(freePort())
  {
    m_thread = std::thread([this]() { m_server->start("127.0.0.1", m_port, "127.0.0.1"); });
    for (int attempt = 0; attempt < 200; ++attempt)
    {
      boost::asio::io_context io;
      tcp::socket socket(io);
      boost::system::error_code error;
      socket.connect(tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), m_port), error);
      if (!error)
      {
        return;
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(25));
    }
    FAIL("the server did not start listening");
  }

  ~Listening()
  {
    m_server->stop();
    m_thread.join();
  }

  Server& server() { return *m_server; }

  // `headers` are sent as given, after a Host naming this server unless one
  // of them is a Host.
  Reply send(const std::string& method, const std::string& path,
             const std::map<std::string, std::string>& headers = {},
             const std::string& body = "") const
  {
    std::string request = method + " " + path + " HTTP/1.1\r\n";
    if (!headers.count("Host"))
    {
      request += "Host: 127.0.0.1:" + std::to_string(m_port) + "\r\n";
    }
    for (const auto& [name, value] : headers)
    {
      request += name + ": " + value + "\r\n";
    }
    const bool upgrade = headers.count("Upgrade") > 0;
    if (!upgrade)
    {
      request += "Connection: close\r\n";
    }
    if (!body.empty())
    {
      request += "Content-Length: " + std::to_string(body.size()) + "\r\n";
    }
    request += "\r\n" + body;

    boost::asio::io_context io;
    tcp::socket socket(io);
    socket.connect(tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), m_port));
    boost::asio::write(socket, boost::asio::buffer(request));

    Reply reply;
    boost::asio::streambuf buffer;
    boost::system::error_code error;
    boost::asio::read_until(socket, buffer, "\r\n\r\n", error);
    if (error)
    {
      return reply;
    }
    std::istream stream(&buffer);
    std::string line;
    std::getline(stream, line);
    if (line.size() > 12)
    {
      reply.status = std::stoi(line.substr(9, 3));
    }
    while (std::getline(stream, line) && line != "\r")
    {
      const auto colon = line.find(':');
      if (colon == std::string::npos)
      {
        continue;
      }
      auto value = line.substr(colon + 1);
      value.erase(0, value.find_first_not_of(' '));
      if (!value.empty() && value.back() == '\r')
      {
        value.pop_back();
      }
      reply.headers[lowered(line.substr(0, colon))] = value;
    }
    // An accepted upgrade stays open; everything else was asked to close.
    if (!upgrade || reply.status != 101)
    {
      boost::asio::read(socket, buffer, error);
      reply.body.assign(std::istreambuf_iterator<char>(stream), {});
    }
    return reply;
  }

  Reply upgrade(const std::map<std::string, std::string>& headers = {},
                const std::string& query = "") const
  {
    auto all = headers;
    all["Upgrade"] = "websocket";
    all["Connection"] = "Upgrade";
    all["Sec-WebSocket-Key"] = "dGhlIHNhbXBsZSBub25jZQ==";
    all["Sec-WebSocket-Version"] = "13";
    return send("GET", "/notifications" + query, all);
  }

  // Send the masked close frame a browser sends with close() (no code),
  // or close(1000), then inspect the server's reply directly on the wire.
  std::string closeReply(bool withCode) const
  {
    boost::asio::io_context io;
    tcp::socket socket(io);
    socket.connect(tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), m_port));
    const std::string request = "GET /notifications HTTP/1.1\r\nHost: 127.0.0.1:" +
      std::to_string(m_port) + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n";
    boost::asio::write(socket, boost::asio::buffer(request));
    boost::asio::streambuf response;
    boost::asio::read_until(socket, response, "\r\n\r\n");
    std::istream stream(&response);
    std::string status;
    std::getline(stream, status);
    REQUIRE(status.find("101") != std::string::npos);

    const std::array<unsigned char, 8> frame = {0x88, static_cast<unsigned char>(withCode ? 0x82 : 0x80),
      0, 0, 0, 0, 0x03, 0xe8}; // zero mask; 1000 in network byte order
    boost::asio::write(socket, boost::asio::buffer(frame.data(), withCode ? 8 : 6));
    socket.non_blocking(true);
    std::string reply;
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(3);
    while (std::chrono::steady_clock::now() < deadline)
    {
      char bytes[128];
      boost::system::error_code error;
      const auto count = socket.read_some(boost::asio::buffer(bytes), error);
      reply.append(bytes, count);
      if (reply.size() >= 2 && reply.size() >= 2 + (static_cast<unsigned char>(reply[1]) & 0x7f)) break;
      if (error && error != boost::asio::error::would_block && error != boost::asio::error::try_again) break;
      std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }
    REQUIRE(reply.size() >= 2);
    return reply;
  }

  size_t runtimeCount() const
  {
    const auto listed = send("GET", "/runtimes");
    REQUIRE(listed.status == 200);
    return json::parse(listed.body)["runtimes"].size();
  }

private:
  std::shared_ptr<App> m_app;
  std::shared_ptr<Server> m_server;
  unsigned short m_port;
  std::thread m_thread;
};

} // namespace listening
