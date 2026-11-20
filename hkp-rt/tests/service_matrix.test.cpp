#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_string.hpp>

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>

#include <app.h>
#include <service.h>
#include <types/data.h>

#include <services/matrix_client.h>

using namespace hkp;
using Catch::Matchers::ContainsSubstring;
using Catch::Matchers::StartsWith;

namespace beast = boost::beast;
namespace http = beast::http;
using boost::asio::ip::tcp;

// ──────────────────────────────────────────────────────────────────────────────
// Matrix Listener and Matrix Sender: what is asked of a homeserver, how its
// answers are read, and both services run against a homeserver on loopback
// that answers the way a real one does.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

std::string percentDecoded(const std::string& text)
{
  std::string out;
  for (std::size_t i = 0; i < text.size(); ++i)
  {
    if (text[i] == '%' && i + 2 < text.size())
    {
      out.push_back(static_cast<char>(std::stoi(text.substr(i + 1, 2), nullptr, 16)));
      i += 2;
    }
    else
    {
      out.push_back(text[i]);
    }
  }
  return out;
}

// The value of one query parameter, decoded.
std::string queryParam(const std::string& target, const std::string& name)
{
  const auto query = target.find('?');
  if (query == std::string::npos)
  {
    return "";
  }
  std::size_t at = query + 1;
  while (at < target.size())
  {
    auto end = target.find('&', at);
    if (end == std::string::npos)
    {
      end = target.size();
    }
    const auto pair = target.substr(at, end - at);
    const auto eq = pair.find('=');
    if (pair.substr(0, eq) == name)
    {
      return eq == std::string::npos ? "" : percentDecoded(pair.substr(eq + 1));
    }
    at = end + 1;
  }
  return "";
}

bool eventually(const std::function<bool()>& check, int tries = 300)
{
  for (int i = 0; i < tries; ++i)
  {
    if (check())
    {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  return check();
}

struct Seen
{
  std::string method;
  std::string target;
  std::string authorization;
  std::string body;
};

// A homeserver on a loopback port, one request at a time, answering with
// whatever the test's handler says.
class FakeHomeserver
{
public:
  using Handler = std::function<std::pair<int, json>(const Seen&)>;

  explicit FakeHomeserver(Handler handler)
    : m_handler(std::move(handler))
    , m_acceptor(m_io, tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), 0))
  {
    m_port = m_acceptor.local_endpoint().port();
    m_thread = std::thread([this] { serve(); });
  }

  ~FakeHomeserver()
  {
    m_stopping = true;
    // A blocking accept is ended by being given something to accept.
    try
    {
      boost::asio::io_context io;
      tcp::socket wake(io);
      wake.connect(tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), m_port));
    }
    catch (...)
    {
    }
    m_thread.join();
  }

  std::string url() const { return "http://127.0.0.1:" + std::to_string(m_port); }

  std::vector<Seen> seen() const
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_seen;
  }

private:
  void serve()
  {
    while (!m_stopping)
    {
      tcp::socket socket(m_io);
      boost::system::error_code ec;
      m_acceptor.accept(socket, ec);
      if (ec || m_stopping)
      {
        continue;
      }
      beast::flat_buffer buffer;
      http::request<http::string_body> req;
      http::read(socket, buffer, req, ec);
      if (ec)
      {
        continue;
      }
      Seen seen{std::string(req.method_string()), std::string(req.target()),
                std::string(req[http::field::authorization]), req.body()};
      {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_seen.push_back(seen);
      }
      const auto [status, body] = m_handler(seen);
      http::response<http::string_body> res{static_cast<http::status>(status), 11};
      res.set(http::field::content_type, "application/json");
      res.body() = body.dump();
      res.keep_alive(false);
      res.prepare_payload();
      http::write(socket, res, ec);
      socket.shutdown(tcp::socket::shutdown_both, ec);
    }
  }

  Handler m_handler;
  boost::asio::io_context m_io;
  tcp::acceptor m_acceptor;
  unsigned short m_port = 0;
  std::thread m_thread;
  std::atomic<bool> m_stopping{false};
  mutable std::mutex m_mutex;
  std::vector<Seen> m_seen;
};

// What reaches the service after the one under test.
std::mutex g_capturedMutex;
std::vector<json> g_captured;

std::vector<json> captured()
{
  std::lock_guard<std::mutex> lock(g_capturedMutex);
  return g_captured;
}

class Capture final : public Service
{
public:
  explicit Capture(const std::string& instanceId) : Service(instanceId, serviceId()) {}
  static std::string serviceId() { return "matrix-test-capture"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data data) override
  {
    if (auto j = getJSONFromData(data); j)
    {
      std::lock_guard<std::mutex> lock(g_capturedMutex);
      g_captured.push_back(*j);
    }
    return data;
  }
};

std::shared_ptr<App> appWith(const std::string& serviceId, const std::string& uuid)
{
  {
    std::lock_guard<std::mutex> lock(g_capturedMutex);
    g_captured.clear();
  }
  auto app = std::make_shared<App>();
  app->registerService<Capture>();
  app->createRuntime(json{
    {"id", "rt-1"}, {"name", "Runtime"},
    {"services", json::array({
      json{{"serviceId", serviceId}, {"uuid", uuid}},
      json{{"serviceId", Capture::serviceId()}, {"uuid", "capture"}},
    })},
  });
  app->setRuntimeSecrets("rt-1", {{"matrix.token", SecretEntry{"syt_secret", {"127.0.0.1"}}}});
  return app;
}

json timelineEvent(const std::string& type, const std::string& sender, const std::string& id,
                   long long ts, const json& content)
{
  return json{{"type", type}, {"sender", sender}, {"event_id", id},
              {"origin_server_ts", ts}, {"content", content}};
}

json syncAnswer(const std::string& nextBatch, const json& join)
{
  return json{{"next_batch", nextBatch}, {"rooms", {{"join", join}}}};
}

} // namespace

// ── Addresses ────────────────────────────────────────────────────────────────

TEST_CASE("a homeserver address is read into its parts", "[services][matrix]")
{
  std::string problem;
  auto server = matrix::parseHomeserver("https://matrix.example.org", problem);
  REQUIRE(server);
  CHECK(server->secure);
  CHECK(server->host == "matrix.example.org");
  CHECK(server->port == "443");
  CHECK(server->basePath.empty());

  server = matrix::parseHomeserver("http://127.0.0.1:8008/prefix/", problem);
  REQUIRE(server);
  CHECK_FALSE(server->secure);
  CHECK(server->port == "8008");
  CHECK(server->basePath == "/prefix");
  CHECK(matrix::whoamiTarget(*server) == "/prefix/_matrix/client/v3/account/whoami");

  CHECK_FALSE(matrix::parseHomeserver("", problem));
  CHECK_FALSE(matrix::parseHomeserver("ftp://matrix.example.org", problem));
  CHECK_THAT(problem, ContainsSubstring("http or https"));
}

TEST_CASE("room ids and aliases are encoded into the path", "[services][matrix]")
{
  std::string problem;
  const auto server = *matrix::parseHomeserver("https://m.example.org", problem);

  CHECK(matrix::encodeComponent("!abc:example.org") == "%21abc%3Aexample.org");
  CHECK(matrix::sendTarget(server, "!abc:example.org", "hkp1.2") ==
        "/_matrix/client/v3/rooms/%21abc%3Aexample.org/send/m.room.message/hkp1.2");
  CHECK(matrix::aliasTarget(server, "#chat:example.org") ==
        "/_matrix/client/v3/directory/room/%23chat%3Aexample.org");
  CHECK(matrix::isRoomAlias("#chat:example.org"));
  CHECK_FALSE(matrix::isRoomAlias("!abc:example.org"));
}

TEST_CASE("the first sync asks only for where to start from", "[services][matrix]")
{
  std::string problem;
  const auto server = *matrix::parseHomeserver("https://m.example.org", problem);

  const auto first = matrix::syncTarget(server, "", {"!a:x"}, 30000);
  CHECK_THAT(first, StartsWith("/_matrix/client/v3/sync?"));
  CHECK(queryParam(first, "timeout") == "0");
  CHECK(queryParam(first, "since").empty());
  const auto filter = json::parse(queryParam(first, "filter"));
  CHECK(filter["room"]["rooms"] == json::array({"!a:x"}));
  CHECK(filter["room"]["timeline"]["limit"] == 1);
  CHECK(filter["presence"]["not_types"] == json::array({"*"}));

  const auto later = matrix::syncTarget(server, "s 1", {}, 30000);
  CHECK(queryParam(later, "timeout") == "30000");
  CHECK(queryParam(later, "since") == "s 1");
  const auto laterFilter = json::parse(queryParam(later, "filter"));
  // No rooms named: every joined room.
  CHECK_FALSE(laterFilter["room"].contains("rooms"));
  CHECK_FALSE(laterFilter["room"]["timeline"].contains("limit"));
}

// ── What a sync says ─────────────────────────────────────────────────────────

TEST_CASE("a sync is read into messages, oldest first", "[services][matrix]")
{
  const auto body = syncAnswer("s2", {
    {"!b:x", {{"timeline", {{"events", json::array({
      timelineEvent("m.room.message", "@bob:x", "$3", 300, {{"msgtype", "m.text"}, {"body", "third"}}),
    })}}}}},
    {"!a:x", {{"timeline", {{"events", json::array({
      timelineEvent("m.room.message", "@alice:x", "$1", 100, {{"msgtype", "m.text"}, {"body", "first"}}),
      timelineEvent("m.room.message", "@me:x", "$2", 200, {{"msgtype", "m.text"}, {"body", "mine"}}),
      // Redacted: the event stays, its body does not.
      timelineEvent("m.room.message", "@alice:x", "$r", 250, json::object()),
      timelineEvent("m.room.member", "@alice:x", "$m", 260, {{"membership", "join"}}),
    })}}}}},
  });

  const auto result = matrix::readSync(body, {}, "@me:x", false);
  CHECK(result.nextBatch == "s2");
  REQUIRE(result.messages.size() == 2);
  CHECK(result.messages[0]["text"] == "first");
  CHECK(result.messages[0]["sender"] == "@alice:x");
  CHECK(result.messages[0]["roomId"] == "!a:x");
  CHECK(result.messages[0]["eventId"] == "$1");
  CHECK(result.messages[0]["timestamp"] == 100);
  CHECK(result.messages[0]["msgtype"] == "m.text");
  CHECK(result.messages[1]["text"] == "third");

  const auto withOwn = matrix::readSync(body, {}, "@me:x", true);
  CHECK(withOwn.messages.size() == 3);

  const auto oneRoom = matrix::readSync(body, {"!b:x"}, "@me:x", false);
  REQUIRE(oneRoom.messages.size() == 1);
  CHECK(oneRoom.messages[0]["roomId"] == "!b:x");
}

TEST_CASE("an edit is read as its new text, naming what it replaces", "[services][matrix]")
{
  const auto body = syncAnswer("s3", {
    {"!a:x", {{"timeline", {{"events", json::array({
      timelineEvent("m.room.message", "@alice:x", "$e", 100, {
        {"msgtype", "m.text"}, {"body", "* fixed"},
        {"m.new_content", {{"msgtype", "m.text"}, {"body", "fixed"}}},
        {"m.relates_to", {{"rel_type", "m.replace"}, {"event_id", "$orig"}}},
      }),
    })}}}}},
  });

  const auto result = matrix::readSync(body, {}, "", false);
  REQUIRE(result.messages.size() == 1);
  CHECK(result.messages[0]["text"] == "fixed");
  CHECK(result.messages[0]["replaces"] == "$orig");
}

TEST_CASE("a room sending encrypted events is reported, not read", "[services][matrix]")
{
  const auto body = syncAnswer("s4", {
    {"!secret:x", {{"timeline", {{"events", json::array({
      timelineEvent("m.room.encrypted", "@alice:x", "$x", 100, {{"algorithm", "m.megolm.v1.aes-sha2"}}),
      timelineEvent("m.room.encrypted", "@alice:x", "$y", 110, {{"algorithm", "m.megolm.v1.aes-sha2"}}),
    })}}}}},
  });

  const auto result = matrix::readSync(body, {}, "", false);
  CHECK(result.messages.empty());
  CHECK(result.encryptedRooms == std::vector<std::string>{"!secret:x"});
}

TEST_CASE("a sync answer without rooms is still a position", "[services][matrix]")
{
  const auto result = matrix::readSync(json{{"next_batch", "s9"}}, {}, "", false);
  CHECK(result.nextBatch == "s9");
  CHECK(result.messages.empty());
}

TEST_CASE("a server timestamp is written as an ISO date", "[services][matrix]")
{
  CHECK(matrix::isoDate(0) == "1970-01-01T00:00:00.000Z");
  CHECK(matrix::isoDate(1763541000123) == "2025-11-19T08:30:00.123Z");
  CHECK(matrix::isoDate(951782400000) == "2000-02-29T00:00:00.000Z");
}

TEST_CASE("a refusal says the Matrix error, or the status", "[services][matrix]")
{
  matrix::Response refused{403, json{{"errcode", "M_FORBIDDEN"}, {"error", "You are not in this room"}}};
  CHECK(matrix::describeError(refused) == "M_FORBIDDEN: You are not in this room");
  CHECK(matrix::describeError(matrix::Response{502, nullptr}) == "homeserver answered 502");

  matrix::Response limited{429, json{{"errcode", "M_LIMIT_EXCEEDED"}, {"retry_after_ms", 1500}}};
  CHECK(matrix::retryAfter(limited, std::chrono::milliseconds(10)) == std::chrono::milliseconds(1500));
  CHECK(matrix::retryAfter(refused, std::chrono::milliseconds(10)) == std::chrono::milliseconds(10));
}

// ── What is sent ─────────────────────────────────────────────────────────────

TEST_CASE("an input becomes the message it says", "[services][matrix]")
{
  auto text = matrix::outgoingMessage(Data(std::string("hello")), "m.text");
  REQUIRE(text);
  CHECK(text->content == json{{"msgtype", "m.text"}, {"body", "hello"}});
  CHECK(text->roomId.empty());

  auto jsonText = matrix::outgoingMessage(Data(json("hi")), "m.notice");
  REQUIRE(jsonText);
  CHECK(jsonText->content == json{{"msgtype", "m.notice"}, {"body", "hi"}});

  auto object = matrix::outgoingMessage(
    Data(json{{"text", "*bold*"}, {"html", "<b>bold</b>"}, {"msgtype", "m.emote"}, {"roomId", "!r:x"}}),
    "m.text");
  REQUIRE(object);
  CHECK(object->content["body"] == "*bold*");
  CHECK(object->content["msgtype"] == "m.emote");
  CHECK(object->content["format"] == "org.matrix.custom.html");
  CHECK(object->content["formatted_body"] == "<b>bold</b>");
  CHECK(object->roomId == "!r:x");

  // What a listener passes on can be sent on as it is.
  auto relayed = matrix::outgoingMessage(Data(json{{"body", "relayed"}}), "m.text");
  REQUIRE(relayed);
  CHECK(relayed->content["body"] == "relayed");

  auto other = matrix::outgoingMessage(Data(json{{"temperature", 21}}), "m.text");
  REQUIRE(other);
  CHECK_THAT(other->content["body"].get<std::string>(), ContainsSubstring("\"temperature\": 21"));

  CHECK_FALSE(matrix::outgoingMessage(Data(std::string()), "m.text"));
  CHECK_FALSE(matrix::outgoingMessage(Data(json{{"text", ""}}), "m.text"));
  CHECK_FALSE(matrix::outgoingMessage(Undefined(), "m.text"));
}

// ── Matrix Sender ────────────────────────────────────────────────────────────

TEST_CASE("the sender resolves an alias and sends with the token from the vault",
          "[services][matrix][matrix-sender]")
{
  FakeHomeserver homeserver([](const Seen& seen) -> std::pair<int, json> {
    if (seen.target.find("/directory/room/%23chat%3Ax") != std::string::npos)
    {
      return {200, json{{"room_id", "!chat:x"}}};
    }
    if (seen.method == "PUT" && seen.target.find("/rooms/%21chat%3Ax/send/m.room.message/") != std::string::npos)
    {
      return {200, json{{"event_id", "$sent"}}};
    }
    return {404, json{{"errcode", "M_UNRECOGNIZED"}}};
  });

  auto app = appWith("matrix-sender", "sender");
  app->configureService("rt-1", "sender", json{
    {"homeserver", homeserver.url()},
    {"accessToken", "{{secret.matrix.token}}"},
    {"roomId", "#chat:x"},
  });

  app->processRuntime("rt-1", Data(std::string("hello room")));

  REQUIRE(eventually([] { return captured().size() == 1; }));
  const auto out = captured()[0];
  CHECK(out["roomId"] == "!chat:x");
  CHECK(out["eventId"] == "$sent");
  CHECK(out["text"] == "hello room");

  const auto seen = homeserver.seen();
  REQUIRE(seen.size() == 2);
  CHECK(seen[1].method == "PUT");
  CHECK(seen[1].authorization == "Bearer syt_secret");
  CHECK(json::parse(seen[1].body) == json{{"msgtype", "m.text"}, {"body", "hello room"}});

  // The board keeps the reference; the value never enters state.
  const auto state = app->getServiceState("rt-1", "sender");
  CHECK(state.dump().find("syt_secret") == std::string::npos);
  CHECK(state["lastEventId"] == "$sent");
  CHECK(state["error"] == "");

  // An alias is looked up once.
  app->processRuntime("rt-1", Data(std::string("again")));
  REQUIRE(eventually([] { return captured().size() == 2; }));
  CHECK(homeserver.seen().size() == 3);
}

TEST_CASE("the sender says why nothing was sent", "[services][matrix][matrix-sender]")
{
  FakeHomeserver homeserver([](const Seen&) -> std::pair<int, json> {
    return {403, json{{"errcode", "M_FORBIDDEN"}, {"error", "You are not in this room"}}};
  });

  auto app = appWith("matrix-sender", "sender");
  app->configureService("rt-1", "sender", json{
    {"homeserver", homeserver.url()},
    {"accessToken", "{{secret.matrix.token}}"},
    {"roomId", "!r:x"},
  });
  app->processRuntime("rt-1", Data(std::string("hello")));
  REQUIRE(eventually([&] {
    return app->getServiceState("rt-1", "sender").value("error", std::string()) ==
           "M_FORBIDDEN: You are not in this room";
  }));
  CHECK(captured().empty());

  // A secret that is not in the vault is named, and nothing is sent for it.
  const auto before = homeserver.seen().size();
  app->configureService("rt-1", "sender", json{{"accessToken", "{{secret.other}}"}});
  app->processRuntime("rt-1", Data(std::string("hello")));
  REQUIRE(eventually([&] {
    return app->getServiceState("rt-1", "sender").value("error", std::string()).find("other") !=
           std::string::npos;
  }));
  CHECK(homeserver.seen().size() == before);
}

// ── Matrix Listener ──────────────────────────────────────────────────────────

TEST_CASE("the listener passes on what is said after it connected",
          "[services][matrix][matrix-listener]")
{
  FakeHomeserver homeserver([](const Seen& seen) -> std::pair<int, json> {
    if (seen.target.find("/account/whoami") != std::string::npos)
    {
      return {200, json{{"user_id", "@me:x"}}};
    }
    const auto since = queryParam(seen.target, "since");
    if (since.empty())
    {
      // Said before the listener connected: where it starts, not what it hears.
      return {200, syncAnswer("s1", {{"!a:x", {{"timeline", {{"events", json::array({
        timelineEvent("m.room.message", "@alice:x", "$old", 50, {{"msgtype", "m.text"}, {"body", "old"}}),
      })}}}}}})};
    }
    if (since == "s1")
    {
      return {200, syncAnswer("s2", {
        {"!a:x", {{"timeline", {{"events", json::array({
          timelineEvent("m.room.message", "@alice:x", "$1", 100, {{"msgtype", "m.text"}, {"body", "hi there"}}),
          timelineEvent("m.room.message", "@me:x", "$2", 110, {{"msgtype", "m.text"}, {"body", "my own"}}),
        })}}}}},
        {"!secret:x", {{"timeline", {{"events", json::array({
          timelineEvent("m.room.encrypted", "@alice:x", "$x", 120, json::object()),
        })}}}}},
      })};
    }
    // Nothing new: a real server holds the request; this one answers soon.
    std::this_thread::sleep_for(std::chrono::milliseconds(20));
    return {200, json{{"next_batch", since}}};
  });

  auto app = appWith("matrix-listener", "listener");
  app->configureService("rt-1", "listener", json{
    {"homeserver", homeserver.url()},
    {"accessToken", "{{secret.matrix.token}}"},
    {"running", true},
  });

  REQUIRE(eventually([] { return captured().size() == 1; }));
  const auto message = captured()[0];
  CHECK(message["text"] == "hi there");
  CHECK(message["sender"] == "@alice:x");
  CHECK(message["roomId"] == "!a:x");

  const auto state = app->getServiceState("rt-1", "listener");
  CHECK(state["connected"] == true);
  CHECK(state["userId"] == "@me:x");
  CHECK(state["since"] == "s2");
  CHECK(state["running"] == true);
  CHECK_THAT(state["warning"].get<std::string>(), ContainsSubstring("!secret:x"));
  CHECK(state.dump().find("syt_secret") == std::string::npos);

  for (const auto& seen : homeserver.seen())
  {
    CHECK(seen.authorization == "Bearer syt_secret");
  }

  app->configureService("rt-1", "listener", json{{"running", false}});
  const auto stopped = app->getServiceState("rt-1", "listener");
  CHECK(stopped["connected"] == false);
  CHECK(stopped["running"] == false);
  std::this_thread::sleep_for(std::chrono::milliseconds(100));
  CHECK(captured().size() == 1);
}

TEST_CASE("the listener stops at once while a sync is held open",
          "[services][matrix][matrix-listener]")
{
  std::atomic<bool> holding{false};
  std::atomic<bool> release{false};
  auto homeserver = std::make_unique<FakeHomeserver>([&](const Seen& seen) -> std::pair<int, json> {
    if (seen.target.find("/account/whoami") != std::string::npos)
    {
      return {200, json{{"user_id", "@me:x"}}};
    }
    if (queryParam(seen.target, "since").empty())
    {
      return {200, json{{"next_batch", "s1"}}};
    }
    // Held the way a homeserver holds a sync with nothing to say.
    holding = true;
    for (int i = 0; i < 500 && !release; ++i)
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    return {200, json{{"next_batch", "s1"}}};
  });

  auto app = appWith("matrix-listener", "listener");
  app->configureService("rt-1", "listener", json{
    {"homeserver", homeserver->url()},
    {"accessToken", "{{secret.matrix.token}}"},
    {"running", true},
  });
  REQUIRE(eventually([&] { return holding.load(); }));

  const auto start = std::chrono::steady_clock::now();
  app->configureService("rt-1", "listener", json{{"running", false}});
  const auto took = std::chrono::steady_clock::now() - start;
  CHECK(took < std::chrono::seconds(1));

  release = true;
  homeserver.reset();
}

TEST_CASE("the listener stops for a token the homeserver does not know",
          "[services][matrix][matrix-listener]")
{
  FakeHomeserver homeserver([](const Seen&) -> std::pair<int, json> {
    return {401, json{{"errcode", "M_UNKNOWN_TOKEN"}, {"error", "Invalid access token passed."}}};
  });

  auto app = appWith("matrix-listener", "listener");
  app->configureService("rt-1", "listener", json{
    {"homeserver", homeserver.url()},
    {"accessToken", "{{secret.matrix.token}}"},
    {"running", true},
  });

  REQUIRE(eventually([&] {
    return app->getServiceState("rt-1", "listener")["running"] == false;
  }));
  const auto state = app->getServiceState("rt-1", "listener");
  CHECK_THAT(state["error"].get<std::string>(), ContainsSubstring("M_UNKNOWN_TOKEN"));
  CHECK(state["connected"] == false);
  // Asked once, not retried against a refusal that will not change.
  std::this_thread::sleep_for(std::chrono::milliseconds(100));
  CHECK(homeserver.seen().size() == 1);
}
