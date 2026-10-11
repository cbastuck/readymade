#include <catch2/catch_test_macros.hpp>

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

#include <crow.h>

#include <app.h>
#include <server.h>

using namespace hkp;
using boost::asio::ip::tcp;

// ──────────────────────────────────────────────────────────────────────────────
// A page in somebody's browser against a runtime server listening on their
// machine.
//
// Every request here is sent over a real loopback socket to a real server, with
// the headers a browser would put on it — a page cannot choose its `Origin`,
// its `Sec-Fetch-Site` or its `Host`, which is what makes them worth checking.
// The rule itself is pinned row by row in origins.test.cpp; this is that it is
// applied, to every way in.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

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

  Reply upgrade(const std::map<std::string, std::string>& headers = {}) const
  {
    auto all = headers;
    all["Upgrade"] = "websocket";
    all["Connection"] = "Upgrade";
    all["Sec-WebSocket-Key"] = "dGhlIHNhbXBsZSBub25jZQ==";
    all["Sec-WebSocket-Version"] = "13";
    return send("GET", "/notifications", all);
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

const std::string kEvil = "https://evil.example";
// A runtime a page would create to get at the machine.
const std::string kRuntime = R"({"id":"planted","name":"planted","services":[]})";

// Exposed with auth and nobody allowed: every token is refused, so the only
// way in is the one a loopback caller is given.
AuthConfig jwtWithNobodyAllowed()
{
  AuthConfig config;
  config.mode = AuthMode::Jwt;
  return config;
}

}

TEST_CASE("a caller that is not a browser drives a loopback server as before",
          "[server][origins]") {
  Listening rt("");

  const auto listed = rt.send("GET", "/runtimes");
  REQUIRE(listed.status == 200);
  REQUIRE_FALSE(listed.has("access-control-allow-origin"));

  const auto created = rt.send("POST", "/runtimes", {{"Content-Type", "application/json"}}, kRuntime);
  REQUIRE(created.status == 200);
  REQUIRE(rt.runtimeCount() == 1);
}

TEST_CASE("a foreign page cannot create a runtime with a request that needs no preflight",
          "[server][origins]") {
  Listening rt("");

  // text/plain is one of the types a browser sends cross-origin without asking
  // first, and the server reads a body whatever it is called.
  const auto refused = rt.send("POST", "/runtimes",
                               {{"Origin", kEvil}, {"Content-Type", "text/plain"}}, kRuntime);

  REQUIRE(refused.status == 403);
  // Nothing that lets the page read the answer, so it cannot tell this from a
  // server that is not running.
  REQUIRE_FALSE(refused.has("access-control-allow-origin"));
  INFO(refused.body);
  REQUIRE(refused.body.size() < 32);
  REQUIRE(rt.runtimeCount() == 0);
}

TEST_CASE("a foreign page is refused whatever it asks for", "[server][origins]") {
  Listening rt("");
  REQUIRE(rt.send("POST", "/runtimes", {{"Content-Type", "application/json"}}, kRuntime).status == 200);

  const std::map<std::string, std::string> evil{{"Origin", kEvil}, {"Content-Type", "application/json"}};
  REQUIRE(rt.send("GET", "/runtimes", evil).status == 403);
  REQUIRE(rt.send("GET", "/identity", evil).status == 403);
  REQUIRE(rt.send("POST", "/runtimes/planted/services", evil,
                  R"({"serviceId":"filesystem","instanceId":"fs"})").status == 403);
  REQUIRE(rt.send("POST", "/runtimes/planted", evil, R"({"path":"/etc/hosts"})").status == 403);
  REQUIRE(rt.send("DELETE", "/runtimes/planted", evil).status == 403);
  REQUIRE(rt.send("POST", "/discover", evil).status == 403);

  REQUIRE(rt.runtimeCount() == 1);
}

TEST_CASE("a preflight is answered for any page, and the request it allows is refused",
          "[server][origins]") {
  Listening rt("");

  // Answered before the headers naming the page are read, so the same for
  // everyone; what keeps a foreign page out is the request that follows.
  const auto preflight = rt.send("OPTIONS", "/runtimes",
                                 {{"Origin", kEvil},
                                  {"Access-Control-Request-Method", "POST"},
                                  {"Access-Control-Request-Headers", "content-type"}});
  REQUIRE(preflight.headers.at("access-control-allow-origin") == "*");

  const auto refused = rt.send("POST", "/runtimes",
                               {{"Origin", kEvil}, {"Content-Type", "application/json"}}, kRuntime);
  REQUIRE(refused.status == 403);
  REQUIRE_FALSE(refused.has("access-control-allow-origin"));
  REQUIRE(rt.runtimeCount() == 0);
}

TEST_CASE("a cross-site request sent without an origin is refused", "[server][origins]") {
  Listening rt("");

  // What an <img> or <script> on another site's page produces.
  REQUIRE(rt.send("GET", "/runtimes", {{"Sec-Fetch-Site", "cross-site"}}).status == 403);
  // The address typed into the address bar.
  REQUIRE(rt.send("GET", "/runtimes", {{"Sec-Fetch-Site", "none"}}).status == 200);
}

TEST_CASE("a page that resolved its own name to this machine is refused",
          "[server][origins]") {
  Listening rt("");

  // DNS rebinding: same-origin to the browser, so no Origin on a GET and the
  // page's own on a POST.
  REQUIRE(rt.send("GET", "/runtimes", {{"Host", "attacker.example:8887"}}).status == 403);
  REQUIRE(rt.send("POST", "/runtimes",
                  {{"Host", "attacker.example:8887"},
                   {"Origin", "http://attacker.example:8887"},
                   {"Content-Type", "text/plain"}},
                  kRuntime).status == 403);
  REQUIRE(rt.send("GET", "/runtimes", {{"Host", "localhost:8887"}}).status == 200);
  REQUIRE(rt.runtimeCount() == 0);
}

TEST_CASE("the apps and pages served from this machine are answered, and told so",
          "[server][origins]") {
  Listening rt("");

  for (const std::string origin : {"http://localhost:5173", "http://127.0.0.1:8555",
                                   "saucer://embedded", "hkp://app",
                                   "https://appassets.androidplatform.net"})
  {
    const auto listed = rt.send("GET", "/runtimes", {{"Origin", origin}});
    INFO(origin);
    REQUIRE(listed.status == 200);
    REQUIRE(listed.headers.at("access-control-allow-origin") == origin);
    REQUIRE(listed.headers.at("vary") == "Origin");
  }

  const auto preflight = rt.send("OPTIONS", "/runtimes",
                                 {{"Origin", "http://localhost:5173"},
                                  {"Access-Control-Request-Method", "POST"},
                                  {"Access-Control-Request-Headers", "content-type"}});
  REQUIRE(preflight.has("access-control-allow-origin"));
  REQUIRE(preflight.headers.at("access-control-allow-headers").find("Authorization") != std::string::npos);
}

TEST_CASE("the website is a site like any other until the host allows it",
          "[server][origins]") {
  Listening rt("");
  const std::map<std::string, std::string> website{{"Origin", "https://readymadeit.com"}};

  REQUIRE(rt.send("GET", "/runtimes", website).status == 403);

  // Allowed while the server runs, with no restart in between.
  rt.server().allowOrigins({"https://readymadeit.com"});
  const auto listed = rt.send("GET", "/runtimes", website);
  REQUIRE(listed.status == 200);
  REQUIRE(listed.headers.at("access-control-allow-origin") == "https://readymadeit.com");

  rt.server().allowOrigins({});
  REQUIRE(rt.send("GET", "/runtimes", website).status == 403);
}

TEST_CASE("a star does not open a server without auth to every page",
          "[server][origins]") {
  Listening rt("*");

  REQUIRE(rt.send("POST", "/runtimes",
                  {{"Origin", kEvil}, {"Content-Type", "text/plain"}}, kRuntime).status == 403);
  REQUIRE(rt.send("GET", "/runtimes", {{"Origin", "http://localhost:5173"}}).status == 200);
  REQUIRE(rt.runtimeCount() == 0);
}

TEST_CASE("a list replaces who may call unasked", "[server][origins]") {
  Listening rt("https://app.example");

  REQUIRE(rt.send("GET", "/runtimes", {{"Origin", "https://app.example"}}).status == 200);
  REQUIRE(rt.send("GET", "/runtimes", {{"Origin", "http://localhost:5173"}}).status == 403);
  REQUIRE(rt.send("GET", "/runtimes").status == 200);
}

TEST_CASE("a foreign page cannot open the notification socket", "[server][origins]") {
  Listening rt("");

  REQUIRE(rt.upgrade({{"Origin", kEvil}}).status != 101);
  REQUIRE(rt.upgrade({{"Origin", "http://attacker.example:8887"},
                      {"Host", "attacker.example:8887"}}).status != 101);
  REQUIRE(rt.upgrade({{"Origin", "http://localhost:5173"}}).status == 101);
  REQUIRE(rt.upgrade().status == 101);
}

TEST_CASE("with auth on, being local lets a caller in and a foreign page is asked for a token",
          "[server][origins]") {
  Listening rt("", jwtWithNobodyAllowed());

  // The owner's own tools and app, on this machine.
  REQUIRE(rt.send("GET", "/runtimes").status == 200);
  REQUIRE(rt.send("GET", "/runtimes", {{"Origin", "saucer://embedded"}}).status == 200);
  REQUIRE(rt.upgrade().status == 101);

  // A page in the owner's browser is on this machine too. It is not refused
  // outright, since it may carry a credential — but it has to.
  const auto asked = rt.send("POST", "/runtimes",
                             {{"Origin", kEvil}, {"Content-Type", "text/plain"}}, kRuntime);
  REQUIRE(asked.status == 401);
  REQUIRE_FALSE(asked.has("access-control-allow-origin"));
  REQUIRE(rt.send("GET", "/runtimes", {{"Host", "attacker.example:8887"}}).status == 401);
  REQUIRE(rt.upgrade({{"Origin", kEvil}}).status != 101);
  REQUIRE(rt.runtimeCount() == 0);
}

TEST_CASE("with auth on and a star, any page may read that it needs a token",
          "[server][origins]") {
  Listening rt("*", jwtWithNobodyAllowed());

  const auto asked = rt.send("GET", "/runtimes", {{"Origin", kEvil}});
  REQUIRE(asked.status == 401);
  // What lets a page that does hold a token learn it was not accepted.
  REQUIRE(asked.headers.at("access-control-allow-origin") == kEvil);
}

// ──────────────────────────────────────────────────────────────────────────────
// A request a host hands over in-process.
//
// The desktop app's page reaches its embedded runtime through the app, not
// through a socket: the scheme handler builds a request and passes it to
// Server::handleRequest. Such a request never crossed the network, so none of
// the above applies to it — and it never passed the middleware either, so it
// carries no context a handler could read a caller from.
//
// Regression: configuring a service this way read the caller out of a context
// that was not there, and took the app down with it.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

crow::response inProcess(Server& server, crow::HTTPMethod method, const std::string& url,
                         const std::string& body = "")
{
  crow::request request;
  request.method = method;
  request.url = url;
  request.body = body;
  // What the app's page sends along, which a handler must not trip over.
  request.headers.insert({"Origin", "saucer://embedded"});
  request.headers.insert({"Content-Type", "application/json"});
  crow::response response;
  server.handleRequest(request, response);
  return response;
}

}

TEST_CASE("a request handed over in-process is served, and names nobody",
          "[server][origins][in-process]") {
  // Listening, as the app's runtime is: routes answer once the server runs.
  Listening rt("");
  auto& server = rt.server();

  const auto created = inProcess(
    server, crow::HTTPMethod::Post, "/runtimes",
    R"({"id":"local","name":"local","services":[{"uuid":"clock","serviceId":"timer","serviceName":"Timer"}]})");
  REQUIRE(created.code == 200);

  // Each of these asks who the caller is.
  const auto configured = inProcess(
    server, crow::HTTPMethod::Post, "/runtimes/local/services/clock", R"({"periodic":false})");
  REQUIRE(configured.code == 200);

  const auto processedService = inProcess(
    server, crow::HTTPMethod::Post, "/runtimes/local/services/clock/process", R"({"tick":1})");
  REQUIRE(processedService.code < 500);

  const auto processed = inProcess(
    server, crow::HTTPMethod::Post, "/runtimes/local", R"({"tick":1})");
  REQUIRE(processed.code < 500);
}

TEST_CASE("notification WebSockets reply to empty close frames without a reserved wire status", "[server][websocket][close]") {
  Listening listening("");
  const auto reply = listening.closeReply(false);
  REQUIRE(static_cast<unsigned char>(reply[0]) == 0x88);
  REQUIRE(static_cast<unsigned char>(reply[1]) == 0);
  REQUIRE(reply.size() == 2);
}

TEST_CASE("notification WebSockets echo a normal close status", "[server][websocket][close]") {
  Listening listening("");
  const auto reply = listening.closeReply(true);
  REQUIRE(static_cast<unsigned char>(reply[0]) == 0x88);
  REQUIRE(static_cast<unsigned char>(reply[1]) == 2);
  REQUIRE(reply.substr(2) == std::string("\x03\xe8", 2));
}
