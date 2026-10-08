#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <deque>
#include <filesystem>
#include <fstream>
#include <functional>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <thread>
#include <vector>

#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/websocket.hpp>

#ifndef _WIN32
#include <sys/stat.h>
#endif

#include <app.h>
#include <binary_frame.h>
#include <coordinator_links.h>
#include <service.h>

#include "services/asset.h"

using namespace hkp;

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;

// ──────────────────────────────────────────────────────────────────────────────
// This runtime server's end of a coordinator connection.
//
// A coordinator never dials a runtime server: a person's client tells the
// server to connect to one, with a ticket, and the runtime that ticket speaks
// for is built and driven over the connection the server opened.
//
// The coordinator itself lives in hkp-node. What stands in for it here speaks
// the same protocol (hkp-node/src/coordinator/participantProtocol.ts) and
// nothing more: it checks the ticket on the upgrade, welcomes whoever says
// hello, and lets a test send what a coordinator would.
// hkp-node/tests/coordinator-rt.test.ts runs the real pair.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

bool eventually(const std::function<bool()>& check, int milliseconds = 3000)
{
  for (int waited = 0; waited < milliseconds; waited += 10)
  {
    if (check())
    {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  return check();
}

/** Accepts joins the way hkp-node's coordinator does. */
class FakeCoordinator
{
public:
  explicit FakeCoordinator(unsigned short port = 0)
    : m_acceptor(m_ioc, tcp::endpoint(net::ip::make_address("127.0.0.1"), port))
  {
    m_port = m_acceptor.local_endpoint().port();
    m_tickets.insert("hkpt_good");
    accept();
    m_thread = std::thread([this]() { m_ioc.run(); });
  }

  ~FakeCoordinator()
  {
    net::post(m_ioc, [this]() {
      beast::error_code ignored;
      m_acceptor.close(ignored);
      if (m_session)
      {
        beast::get_lowest_layer(m_session->ws).socket().close(ignored);
      }
    });
    m_ioc.stop();
    if (m_thread.joinable())
    {
      m_thread.join();
    }
  }

  unsigned short port() const { return m_port; }
  std::string url() const
  {
    return "http://127.0.0.1:" + std::to_string(m_port) + "/coordinator";
  }

  void forget(const std::string& ticket)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_tickets.erase(ticket);
  }

  // What the connected runtime server has said.
  std::vector<json> hellos()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_hellos;
  }
  std::vector<json> events(const std::string& type)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<json> matching;
    for (const auto& event : m_events)
    {
      if (event.value("type", std::string()) == type)
      {
        matching.push_back(event);
      }
    }
    return matching;
  }
  std::vector<binary_frame::Frame> binary()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_binary;
  }
  bool connected()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_connected;
  }

  void send(const json& message) { write(message.dump(), false); }
  void sendBinary(const json& header, const json& shape, const std::string& payload)
  {
    write(binary_frame::encode(header, shape, payload), true);
  }

  /** Asks, as a coordinator would, and waits for the answer. */
  json request(const std::string& op, json payload = json::object())
  {
    const std::string requestId = "req-" + std::to_string(++m_counter);
    payload["type"] = "request";
    payload["requestId"] = requestId;
    payload["op"] = op;
    send(payload);
    json answer;
    const bool answered = eventually([&]() {
      std::lock_guard<std::mutex> lock(m_mutex);
      auto it = m_responses.find(requestId);
      if (it == m_responses.end())
      {
        return false;
      }
      answer = it->second;
      return true;
    });
    return answered ? answer : json{{"ok", false}, {"error", "no answer"}};
  }

  /** Closes the connection with a code, as a revoke or a replacement does. */
  void close(unsigned code)
  {
    net::post(m_ioc, [this, code]() {
      if (m_session)
      {
        auto session = m_session;
        session->ws.async_close(
          websocket::close_reason(static_cast<websocket::close_code>(code), "bye"),
          [session](beast::error_code) {});
      }
    });
  }

  /** Drops the connection without a word, as a network does. */
  void drop()
  {
    net::post(m_ioc, [this]() {
      if (m_session)
      {
        beast::error_code ignored;
        beast::get_lowest_layer(m_session->ws).socket().close(ignored);
      }
    });
  }

private:
  struct Session : std::enable_shared_from_this<Session>
  {
    explicit Session(tcp::socket socket) : ws(std::move(socket)) {}
    websocket::stream<beast::tcp_stream> ws;
    beast::flat_buffer buffer;
    http::request<http::string_body> request;
    std::deque<std::pair<std::string, bool>> queue;
    bool writing = false;
  };

  void accept()
  {
    m_acceptor.async_accept([this](beast::error_code ec, tcp::socket socket) {
      if (ec)
      {
        return;
      }
      auto session = std::make_shared<Session>(std::move(socket));
      http::async_read(session->ws.next_layer(), session->buffer, session->request,
        [this, session](beast::error_code ec, std::size_t) {
          if (!ec)
          {
            upgrade(session);
          }
        });
      accept();
    });
  }

  void upgrade(const std::shared_ptr<Session>& session)
  {
    const std::string header(session->request[http::field::authorization]);
    const std::string ticket =
      header.rfind("Bearer ", 0) == 0 ? header.substr(7) : std::string();
    bool known = false;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      known = m_tickets.count(ticket) > 0;
    }
    if (!known)
    {
      auto refusal = std::make_shared<http::response<http::string_body>>(
        http::status::unauthorized, session->request.version());
      refusal->prepare_payload();
      http::async_write(session->ws.next_layer(), *refusal,
        [session, refusal](beast::error_code, std::size_t) {});
      return;
    }
    session->ws.read_message_max(0);
    session->ws.async_accept(session->request, [this, session](beast::error_code ec) {
      if (ec)
      {
        return;
      }
      m_session = session;
      {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_connected = true;
      }
      read(session);
    });
  }

  void read(const std::shared_ptr<Session>& session)
  {
    session->buffer.consume(session->buffer.size());
    session->ws.async_read(session->buffer,
      [this, session](beast::error_code ec, std::size_t) {
        if (ec)
        {
          std::lock_guard<std::mutex> lock(m_mutex);
          if (m_session == session)
          {
            m_connected = false;
          }
          return;
        }
        const std::string raw = beast::buffers_to_string(session->buffer.data());
        if (session->ws.got_binary())
        {
          if (auto frame = binary_frame::decode(raw))
          {
            std::lock_guard<std::mutex> lock(m_mutex);
            m_binary.push_back(*frame);
          }
        }
        else
        {
          const json message = json::parse(raw, nullptr, false);
          const auto type = message.value("type", std::string());
          if (type == "hello")
          {
            {
              std::lock_guard<std::mutex> lock(m_mutex);
              m_hellos.push_back(message);
            }
            enqueue(session, json{{"type", "welcome"},
                                  {"boardName", "doorbell"},
                                  {"runtimeId", "rt"}}.dump(), false);
          }
          else if (type == "response")
          {
            std::lock_guard<std::mutex> lock(m_mutex);
            m_responses[message.value("requestId", std::string())] = message;
          }
          else
          {
            std::lock_guard<std::mutex> lock(m_mutex);
            m_events.push_back(message);
          }
        }
        read(session);
      });
  }

  void write(std::string bytes, bool binary)
  {
    net::post(m_ioc, [this, bytes = std::move(bytes), binary]() mutable {
      if (m_session)
      {
        enqueue(m_session, std::move(bytes), binary);
      }
    });
  }

  void enqueue(const std::shared_ptr<Session>& session, std::string bytes, bool binary)
  {
    session->queue.emplace_back(std::move(bytes), binary);
    flush(session);
  }

  void flush(const std::shared_ptr<Session>& session)
  {
    if (session->writing || session->queue.empty())
    {
      return;
    }
    session->writing = true;
    session->ws.binary(session->queue.front().second);
    session->ws.async_write(net::buffer(session->queue.front().first),
      [this, session](beast::error_code ec, std::size_t) {
        session->writing = false;
        if (ec)
        {
          return;
        }
        session->queue.pop_front();
        flush(session);
      });
  }

  net::io_context m_ioc;
  tcp::acceptor m_acceptor;
  unsigned short m_port = 0;
  std::thread m_thread;
  std::shared_ptr<Session> m_session;

  std::mutex m_mutex;
  std::set<std::string> m_tickets;
  std::vector<json> m_hellos;
  std::vector<json> m_events;
  std::vector<binary_frame::Frame> m_binary;
  std::map<std::string, json> m_responses;
  bool m_connected = false;
  std::atomic<int> m_counter{0};
};

class Echo final : public Service
{
public:
  explicit Echo(const std::string& instanceId) : Service(instanceId, serviceId()) {}
  static std::string serviceId() { return "echo"; }
  std::string getServiceId() const override { return serviceId(); }
  json configure(Data data) override
  {
    if (auto config = getJSONFromData(data))
    {
      m_state.update(*config);
    }
    return m_state;
  }
  json getState() const override { return m_state; }
  Data process(Data data) override { return data; }

private:
  json m_state = json::object();
};

CoordinatorLinksOptions fast()
{
  CoordinatorLinksOptions options;
  options.reconnectDelay = std::chrono::milliseconds(20);
  options.maxReconnectDelay = std::chrono::milliseconds(50);
  options.introduceTimeout = std::chrono::milliseconds(2000);
  return options;
}

std::shared_ptr<App> makeApp()
{
  auto app = std::make_shared<App>();
  app->registerService<Echo>();
  return app;
}

LinkRecord introduction(const FakeCoordinator& coordinator,
                        const std::string& ticket = "hkpt_good")
{
  return LinkRecord{"doorbell", "rt", coordinator.url(), ticket};
}

json provision(json services = json::array({
  json{{"uuid", "echo-1"}, {"serviceId", "echo"}, {"serviceName", "Echo"},
       {"state", json::object()}},
}))
{
  return json{
    {"name", "Cpp"},
    {"boardName", "somebody-else's"},
    {"state", json::object()},
    {"services", std::move(services)},
  };
}

std::string temporaryFile(const std::string& name)
{
  namespace fs = std::filesystem;
  const auto dir = fs::temp_directory_path() /
    ("hkp-links-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
  return (dir / name).string();
}

} // namespace

TEST_CASE("the join address is the coordinator's join endpoint", "[links]") {
  REQUIRE(joinUrlFor("http://127.0.0.1:8080/coordinator") ==
          "ws://127.0.0.1:8080/coordinator/join");
  REQUIRE(joinUrlFor("https://cloud.example/coordinator/") ==
          "wss://cloud.example/coordinator/join");
  REQUIRE(joinUrlFor("https://cloud.example/coordinator?x=1") ==
          "wss://cloud.example/coordinator/join");
}

TEST_CASE("an address that is not http is not a coordinator's", "[links]") {
  REQUIRE_THROWS_AS(joinUrlFor("ftp://example.test/coordinator"), std::invalid_argument);
  REQUIRE_THROWS_AS(joinUrlFor("cloud.example/coordinator"), std::invalid_argument);
  REQUIRE_THROWS_AS(joinUrlFor("http://"), std::invalid_argument);
}

TEST_CASE("a frame is read as the coordinator writes it", "[links][binary]") {
  // The fixture hkp-node's encoder produces; hkp-frontend's and hkp-python's
  // tests read the same bytes.
  const std::string hex =
    "000000777b2274797065223a2270726f6365737352756e74696d65222c2272756e74696d654964223a227569222c22726571756573744964223a22722d31222c2262696e617279223a7b226b696e64223a226d69786564222c226a736f6e223a7b226d657461223a7b226e616d65223a22612e62696e227d7d7d7d0001feff";
  std::string raw;
  for (std::size_t i = 0; i < hex.size(); i += 2)
  {
    raw.push_back(static_cast<char>(std::stoi(hex.substr(i, 2), nullptr, 16)));
  }

  const auto frame = binary_frame::decode(raw);

  REQUIRE(frame.has_value());
  REQUIRE(frame->header == json{{"type", "processRuntime"},
                                {"runtimeId", "ui"},
                                {"requestId", "r-1"}});
  const auto value = getMixedDataFromData(
    binary_frame::fromBinary(frame->shape, frame->payload));
  REQUIRE(value.has_value());
  REQUIRE(value->meta == json{{"name", "a.bin"}});
  REQUIRE(value->binary == BinaryData{0, 1, 254, 255});
}

TEST_CASE("each kind of value keeps what it is across a frame", "[links][binary]") {
  SECTION("bytes") {
    const auto sent = binary_frame::toBinary(Data(BinaryData{1, 2, 3}));
    REQUIRE(sent.has_value());
    REQUIRE(sent->first == json{{"kind", "bytes"}});
    const auto back = getBinaryFromData(binary_frame::fromBinary(sent->first, sent->second));
    REQUIRE(back.has_value());
    REQUIRE(*back == BinaryData{1, 2, 3});
  }
  SECTION("a ring buffer, its samples and what identifies it") {
    auto buffer = std::make_shared<FloatRingBuffer>("test");
    buffer->append(0.5f);
    buffer->append(-1.0f);
    buffer->setIdentity(7, 1234);

    const auto sent = binary_frame::toBinary(Data(buffer));

    REQUIRE(sent.has_value());
    REQUIRE(sent->first["kind"] == "floatRingBuffer");
    REQUIRE(sent->first["id"] == 7);
    REQUIRE(sent->first["ts"] == 1234);
    REQUIRE(sent->second.size() == 8);
    // Sending left the buffer as it was, for whoever else is handed it.
    REQUIRE(buffer->availableCount() == 2);

    const auto back = getRingBufferFromData(
      binary_frame::fromBinary(sent->first, sent->second));
    REQUIRE(back);
    REQUIRE(back->id() == 7);
    REQUIRE(back->timestamp() == 1234);
    std::vector<float> samples;
    back->consumeAvailable(samples, false);
    REQUIRE(samples == std::vector<float>{0.5f, -1.0f});
  }
  SECTION("bytes with something said about them") {
    MixedData mixed;
    mixed.meta = json{{"name", "clip.mp3"}};
    mixed.binary = BinaryData{9};
    const auto sent = binary_frame::toBinary(Data(mixed));
    REQUIRE(sent.has_value());
    REQUIRE(sent->first == json{{"kind", "mixed"},
                                {"json", {{"meta", {{"name", "clip.mp3"}}}}}});
  }
  SECTION("JSON and text travel as text") {
    REQUIRE_FALSE(binary_frame::toBinary(Data(json{{"a", 1}})).has_value());
    REQUIRE_FALSE(binary_frame::toBinary(Data(std::string("text"))).has_value());
  }
}

TEST_CASE("a frame that is not one is not read", "[links][binary]") {
  REQUIRE_FALSE(binary_frame::decode(std::string("\x00\x00", 2)).has_value());
  REQUIRE_FALSE(binary_frame::decode(std::string("\x00\x00\x00\x32{", 5)).has_value());
  REQUIRE_FALSE(binary_frame::decode(std::string("\x00\x00\x00\x01x", 5)).has_value());
  REQUIRE_FALSE(binary_frame::decode(
    binary_frame::encode(json{{"type", "result"}}, json{{"kind", "unknown"}}, "")).has_value());
}

TEST_CASE("it connects with the ticket and says what it is", "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());

  const auto reason = links.introduce(introduction(coordinator));

  REQUIRE(reason.empty());
  REQUIRE(eventually([&] { return coordinator.hellos().size() == 1; }));
  const auto hello = coordinator.hellos()[0];
  REQUIRE(hello["server"] == "c++");
  REQUIRE(hello["registry"].is_array());
  REQUIRE(hello["runtimeExists"] == false);

  // The link is reported, never the ticket.
  const auto listed = links.list();
  REQUIRE(listed.size() == 1);
  REQUIRE(listed[0]["runtimeId"] == "rt");
  REQUIRE(listed[0]["boardName"] == "doorbell");
  REQUIRE(listed[0]["connected"] == true);
  REQUIRE_FALSE(listed[0].contains("ticket"));
}

TEST_CASE("it says why when the ticket is not accepted, and keeps nothing",
          "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  auto store = createMemoryLinkStore();
  CoordinatorLinks links(app, store, fast());

  const auto reason = links.introduce(introduction(coordinator, "hkpt_stale"));

  REQUIRE(reason == "the coordinator did not accept the ticket");
  REQUIRE(links.list().empty());
  REQUIRE(store->load().empty());
}

TEST_CASE("it says why when there is no coordinator there", "[links]") {
  unsigned short port = 0;
  {
    FakeCoordinator gone;
    port = gone.port();
  }
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());

  const auto reason = links.introduce(
    LinkRecord{"doorbell", "rt",
               "http://127.0.0.1:" + std::to_string(port) + "/coordinator",
               "hkpt_good"});

  REQUIRE_FALSE(reason.empty());
  REQUIRE(links.list().empty());
}

TEST_CASE("it refuses an address that is not a coordinator's without connecting",
          "[links]") {
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());

  const auto reason = links.introduce(
    LinkRecord{"doorbell", "rt", "ftp://example.test", "hkpt_good"});

  REQUIRE(reason.find("Not a coordinator address") != std::string::npos);
}

TEST_CASE("the coordinator builds, configures and releases the runtime",
          "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());

  const auto built = coordinator.request("provision", provision());

  REQUIRE(built["ok"] == true);
  REQUIRE(built["data"]["services"][0]["uuid"] == "echo-1");
  REQUIRE(built["data"]["missingSecrets"].empty());
  const auto runtime = app->getRuntime("rt", "doorbell");
  REQUIRE(runtime.has_value());
  // The board the link was introduced for, whatever the request said: a
  // ticket speaks for one board.
  REQUIRE(runtime->boardName == "doorbell");
  // The coordinator's until it says otherwise.
  REQUIRE_FALSE(runtime->garbageCollected);

  const auto configured = coordinator.request(
    "configureService", json{{"serviceUuid", "echo-1"}, {"config", {{"n", 5}}}});
  REQUIRE(configured["ok"] == true);
  REQUIRE(configured["data"]["n"] == 5);

  const auto described = coordinator.request("describe");
  REQUIRE(described["data"]["services"][0]["state"]["n"] == 5);

  const auto settings = coordinator.request(
    "setState", json{{"state", {{"logging", true}, {"logLevel", "debug"}}}});
  REQUIRE(settings["data"]["logging"] == true);

  REQUIRE(coordinator.request("remove")["ok"] == true);
  REQUIRE_FALSE(app->getRuntime("rt", "doorbell").has_value());
  // Removing one that is not there is a success.
  REQUIRE(coordinator.request("remove")["ok"] == true);
}

TEST_CASE("what it cannot do is answered with an error rather than silence",
          "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());

  const auto described = coordinator.request("describe");
  REQUIRE(described["ok"] == false);
  REQUIRE(described["error"] == "the runtime is not running");

  const auto unknown = coordinator.request("launch");
  REQUIRE(unknown["ok"] == false);

  const auto malformed = coordinator.request(
    "provision", provision(json::array({json{{"serviceId", "no-such-service"},
                                             {"uuid", "x"}}})));
  REQUIRE(malformed["ok"] == false);
  REQUIRE_FALSE(app->getRuntime("rt", "doorbell").has_value());
}

TEST_CASE("it is driven over the link and says what its runtime says",
          "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);

  coordinator.send(json{{"type", "processRuntime"}, {"params", {{"hello", "there"}}}});

  REQUIRE(eventually([&] { return coordinator.events("result").size() == 1; }));
  REQUIRE(coordinator.events("result")[0]["data"] == json{{"hello", "there"}});
}

TEST_CASE("it takes the run and its caller from the coordinator, and hands them back",
          "[links][caller]") {
  // The link is the board's own, and the coordinator on it is what verified
  // the person — so here, and nowhere else, a caller is taken as stated. It
  // comes back with the result, which is how the board's next runtime learns
  // who began the run.
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);
  const json alice = {{"sub", "auth0|alice"}, {"email", "alice@example.com"}, {"name", "Alice"}};
  const json run = {
    {"runId", "run-1"},
    {"actor", {{"kind", "person"}, {"sub", alice["sub"]},
               {"email", alice["email"]}, {"name", alice["name"]},
               {"expiresAt", 9999999999999LL}}}
  };

  coordinator.send(json{{"type", "processRuntime"}, {"params", {{"n", 1}}}, {"context", run}});

  REQUIRE(eventually([&] { return coordinator.events("result").size() == 1; }));
  REQUIRE(coordinator.events("result")[0]["context"] == run);
  // What a service said while it ran is the caller's to hear, and says so.
  REQUIRE(eventually([&] { return !coordinator.events("notification").empty(); }));
  for (const auto& said : coordinator.events("notification"))
  {
    REQUIRE(said["context"] == run);
  }
}

TEST_CASE("a run without a stated actor is the board's", "[links][actor]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);

  coordinator.send(json{{"type", "processRuntime"}, {"params", {{"n", 1}}}});

  REQUIRE(eventually([&] { return coordinator.events("result").size() == 1; }));
  const auto context = coordinator.events("result")[0]["context"];
  REQUIRE(context["runId"].is_string());
  REQUIRE(context["actor"] == json{{"kind", "board"}});
  for (const auto& said : coordinator.events("notification"))
  {
    REQUIRE(said["context"]["actor"] == json{{"kind", "board"}});
  }
}

TEST_CASE("it begins at one service when asked, and says what came of it",
          "[links][caller]") {
  // What a facade's process action means on a deployed board: the answer says
  // the work was taken, and what the pipeline produced follows as the
  // runtime's output, in the same run.
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision(json::array({
    json{{"uuid", "first"}, {"serviceId", "echo"}, {"serviceName", "Echo"},
         {"state", json::object()}},
    json{{"uuid", "second"}, {"serviceId", "echo"}, {"serviceName", "Echo"},
         {"state", json::object()}},
  })))["ok"] == true);
  const json run = {
    {"runId", "run-2"},
    {"actor", {{"kind", "person"}, {"sub", "auth0|alice"},
               {"expiresAt", 9999999999999LL}}}
  };

  const auto answer = coordinator.request(
    "processService",
    json{{"serviceUuid", "second"}, {"params", {{"n", 2}}}, {"context", run}});

  REQUIRE(answer["ok"] == true);
  REQUIRE(answer["data"] == json{{"accepted", true}});
  REQUIRE(eventually([&] { return coordinator.events("result").size() == 1; }));
  REQUIRE(coordinator.events("result")[0]["data"] == json{{"n", 2}});
  REQUIRE(coordinator.events("result")[0]["context"] == run);
  // It began at the second service: the first never ran.
  for (const auto& said : coordinator.events("notification"))
  {
    REQUIRE(said["serviceUuid"] != "first");
  }
}

TEST_CASE("it says why it cannot begin at a service that is not there",
          "[links][caller]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());

  const auto before = coordinator.request("processService", json{{"serviceUuid", "echo-1"}});
  REQUIRE(before["ok"] == false);
  REQUIRE(before["error"] == "the runtime is not running");

  REQUIRE(coordinator.request("provision", provision())["ok"] == true);
  const auto unknown = coordinator.request("processService", json{{"serviceUuid", "nobody"}});
  REQUIRE(unknown["ok"] == false);
  REQUIRE(unknown["error"] == "no service \"nobody\"");
}

TEST_CASE("it is built with the assets the coordinator sends", "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  app->registerService<Asset>();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  auto description = provision(json::array({
    json{{"uuid", "asset-1"}, {"serviceId", "asset"}, {"serviceName", "Asset"},
         {"state", {{"asset", "hkp-asset://day"}}}},
  }));
  description["assets"] = {
    {"day", {{"id", "day"}, {"mediaType", "text/plain"}, {"text", "sun"}}},
  };
  REQUIRE(coordinator.request("provision", description)["ok"] == true);

  coordinator.send(json{{"type", "processRuntime"}, {"params", json::object()}});

  REQUIRE(eventually([&] { return coordinator.events("result").size() == 1; }));
  const auto result = coordinator.events("result")[0]["data"];
  REQUIRE(result["meta"]["status"] == 200);
  REQUIRE(result["body"] == "sun");
}

TEST_CASE("bytes arrive as bytes and leave as bytes", "[links][binary]") {
  // As text they could only be described, and the runtime after this one would
  // be handed a description.
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);
  std::string sent;
  for (int i = 0; i < 70000; ++i)
  {
    sent.push_back(static_cast<char>((i * 7) % 256));
  }

  coordinator.sendBinary(json{{"type", "processRuntime"}}, json{{"kind", "bytes"}}, sent);

  REQUIRE(eventually([&] { return coordinator.binary().size() == 1; }));
  const auto frame = coordinator.binary()[0];
  // The header is the message without its value: what it is, and the run it
  // was produced in — which a coordinator hands to the next runtime.
  REQUIRE(frame.header["type"] == "result");
  REQUIRE(frame.header["context"]["runId"].is_string());
  REQUIRE(frame.shape == json{{"kind", "bytes"}});
  REQUIRE(frame.payload == sent);
  // Nothing was also said as text.
  REQUIRE(coordinator.events("result").empty());
}

TEST_CASE("a ring buffer crosses the link as one", "[links][binary]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);
  const float samples[] = {0.5f, -1.0f, 0.25f};
  const std::string payload(reinterpret_cast<const char*>(samples), sizeof(samples));

  coordinator.sendBinary(json{{"type", "processRuntime"}},
                         json{{"kind", "floatRingBuffer"}, {"id", 7}, {"ts", 1234}},
                         payload);

  REQUIRE(eventually([&] { return coordinator.binary().size() == 1; }));
  const auto frame = coordinator.binary()[0];
  REQUIRE(frame.shape["kind"] == "floatRingBuffer");
  REQUIRE(frame.shape["id"] == 7);
  REQUIRE(frame.shape["ts"] == 1234);
  REQUIRE(frame.payload == payload);
}

TEST_CASE("a run with nothing on its input is still a run", "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request(
    "setState", json{{"state", {{"logging", true}, {"logLevel", "debug"}}}})["ok"] == false);
  REQUIRE(coordinator.request("provision", json{
    {"name", "Cpp"}, {"boardName", "doorbell"},
    {"state", {{"logging", true}, {"logLevel", "debug"}}},
    {"services", json::array({json{{"uuid", "echo-1"}, {"serviceId", "echo"}}})},
  })["ok"] == true);

  coordinator.send(json{{"type", "processRuntime"}, {"params", nullptr},
                        {"context", {{"runId", "run-9"}}}});

  // Nothing to hand on, so no result — but the run happened, under the run the
  // coordinator named, and the board's log hears of it.
  REQUIRE(eventually([&] { return !coordinator.events("log").empty(); }));
  REQUIRE(coordinator.events("log")[0]["entry"]["runId"] == "run-9");
  REQUIRE(coordinator.events("result").empty());
}

TEST_CASE("it reconnects on its own and says its runtime is still there",
          "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);

  coordinator.drop();

  REQUIRE(eventually([&] { return coordinator.hellos().size() == 2; }));
  REQUIRE(coordinator.hellos()[1]["runtimeExists"] == true);
  REQUIRE(app->getRuntime("rt", "doorbell").has_value());
}

TEST_CASE("it drops the link and the runtime when its ticket is revoked",
          "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  auto store = createMemoryLinkStore();
  CoordinatorLinks links(app, store, fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);
  REQUIRE(store->load().size() == 1);

  coordinator.close(4403);

  REQUIRE(eventually([&] { return links.list().empty(); }));
  REQUIRE(eventually([&] { return !app->getRuntime("rt", "doorbell").has_value(); }));
  REQUIRE(store->load().empty());
  // And it does not come back.
  std::this_thread::sleep_for(std::chrono::milliseconds(200));
  REQUIRE(coordinator.hellos().size() == 1);
}

TEST_CASE("it forgets a ticket the coordinator no longer holds", "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  auto store = createMemoryLinkStore();
  CoordinatorLinks links(app, store, fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);

  coordinator.forget("hkpt_good");
  coordinator.drop();

  REQUIRE(eventually([&] { return links.list().empty(); }));
  REQUIRE(eventually([&] { return !app->getRuntime("rt", "doorbell").has_value(); }));
  REQUIRE(store->load().empty());
}

TEST_CASE("it reconnects after a restart with the ticket it kept", "[links]") {
  FakeCoordinator coordinator;
  auto store = createMemoryLinkStore();
  {
    auto app = makeApp();
    CoordinatorLinks links(app, store, fast());
    REQUIRE(links.introduce(introduction(coordinator)).empty());
  }
  REQUIRE(eventually([&] { return !coordinator.connected(); }));

  // A new process: nothing but what the store held.
  auto app = makeApp();
  CoordinatorLinks links(app, store, fast());
  links.restore();

  REQUIRE(eventually([&] { return coordinator.hellos().size() == 2; }));
  REQUIRE(coordinator.hellos()[1]["runtimeExists"] == false);
  REQUIRE(eventually([&] {
    const auto listed = links.list();
    return listed.size() == 1 && listed[0]["connected"] == true;
  }));
}

TEST_CASE("it leaves a board when asked, dropping the runtime", "[links]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  auto store = createMemoryLinkStore();
  CoordinatorLinks links(app, store, fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);

  REQUIRE(links.remove("doorbell", "rt"));

  REQUIRE_FALSE(app->getRuntime("rt", "doorbell").has_value());
  REQUIRE(links.list().empty());
  REQUIRE(store->load().empty());
  REQUIRE_FALSE(links.remove("doorbell", "rt"));
}

TEST_CASE("a board's runtime is not the one a client creates under its id",
          "[links]") {
  // What opening the same board in the playground does: it creates a runtime
  // under the id the deployed board uses, and removes it when it leaves.
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);
  const auto deployed = app->getRuntime("rt", "doorbell")->services.size();

  app->createRuntime(json{{"id", "rt"}, {"name", "Cpp"}, {"state", json::object()},
                          {"services", json::array()}});
  // The client sees its own runtime and never the board's.
  REQUIRE(app->getRuntimes().size() == 1);
  REQUIRE(app->getRuntimes()[0].services.empty());
  app->removeRuntime("rt");
  app->removeAllRuntimes();

  REQUIRE(app->getRuntime("rt", "doorbell").has_value());
  REQUIRE(app->getRuntime("rt", "doorbell")->services.size() == deployed);
  REQUIRE(coordinator.request("describe")["ok"] == true);
}

TEST_CASE("a runtime id two boards share is a link of each", "[links]") {
  // Boards ship the same handful of ids. Being introduced for a second board
  // must not cost the first one its link.
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());

  REQUIRE(links.introduce(LinkRecord{"doorbell", "rt", coordinator.url(), "hkpt_good"}).empty());
  REQUIRE(links.introduce(LinkRecord{"garden", "rt", coordinator.url(), "hkpt_good"}).empty());

  const auto listed = links.list();
  REQUIRE(listed.size() == 2);
  REQUIRE(listed[0]["connected"] == true);
  REQUIRE(listed[1]["connected"] == true);
  REQUIRE(listed[0]["boardName"] != listed[1]["boardName"]);
}

TEST_CASE("being introduced again costs the board neither its runtime nor its connection",
          "[links]") {
  // Being introduced is the first step of a deploy that may yet fail.
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator)).empty());
  REQUIRE(coordinator.request("provision", provision())["ok"] == true);

  // Not even a ticket the coordinator would refuse costs it the link.
  REQUIRE(links.introduce(introduction(coordinator, "hkpt_never-presented")).empty());

  REQUIRE(app->getRuntime("rt", "doorbell").has_value());
  REQUIRE(coordinator.hellos().size() == 1);
  REQUIRE(links.list().size() == 1);
  REQUIRE(links.list()[0]["connected"] == true);
  REQUIRE(coordinator.request("describe")["ok"] == true);
}

TEST_CASE("it refuses to be another coordinator's for a runtime it already serves",
          "[links]") {
  FakeCoordinator first;
  FakeCoordinator second;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(first)).empty());

  const auto reason = links.introduce(introduction(second));

  REQUIRE(reason.find("already deployed here by") != std::string::npos);
  REQUIRE(reason.find(first.url()) != std::string::npos);
  REQUIRE(second.hellos().empty());
  REQUIRE(links.list().size() == 1);
  REQUIRE(links.list()[0]["coordinatorUrl"] == first.url());
}

TEST_CASE("credentials come from the client, and missing ones are named",
          "[links][secrets]") {
  FakeCoordinator coordinator;
  auto app = makeApp();
  CoordinatorLinks links(app, createMemoryLinkStore(), fast());
  REQUIRE(links.introduce(introduction(coordinator),
                          {{"imap.password", SecretEntry{"hunter2", {}}}}).empty());

  const auto built = coordinator.request("provision", provision(json::array({
    json{{"uuid", "echo-1"}, {"serviceId", "echo"},
         {"state", {{"password", "{{secret.imap.password}}"},
                    {"token", "{{secret.api.token}}"}}}},
  })));

  REQUIRE(built["ok"] == true);
  REQUIRE(built["data"]["missingSecrets"] == json::array({"api.token"}));
  // What the coordinator is told names the reference, never the value.
  REQUIRE(built.dump().find("hunter2") == std::string::npos);
}

TEST_CASE("tickets on disk are readable by their owner only", "[links][store]") {
  const auto file = temporaryFile("coordinator-links.json");
  auto store = createFileLinkStore(file);

  store->save({LinkRecord{"doorbell", "rt", "http://c.example/coordinator", "hkpt_x"}});

  const auto read = createFileLinkStore(file)->load();
  REQUIRE(read.size() == 1);
  REQUIRE(read[0].ticket == "hkpt_x");
  REQUIRE(read[0].runtimeId == "rt");
#ifndef _WIN32
  struct stat info;
  REQUIRE(::stat(file.c_str(), &info) == 0);
  REQUIRE((info.st_mode & 0777) == 0600);
#endif
  std::filesystem::remove_all(std::filesystem::path(file).parent_path());
}

TEST_CASE("nothing is read back from a file that is missing or not what it wrote",
          "[links][store]") {
  const auto file = temporaryFile("coordinator-links.json");
  REQUIRE(createFileLinkStore(file)->load().empty());

  std::filesystem::create_directories(std::filesystem::path(file).parent_path());
  { std::ofstream out(file); out << "not json"; }
  REQUIRE(createFileLinkStore(file)->load().empty());
  { std::ofstream out(file); out << R"([{"runtimeId":"rt"}, 4, {"boardName":"b","runtimeId":"r","coordinatorUrl":"http://c","ticket":"t"}])"; }
  REQUIRE(createFileLinkStore(file)->load().size() == 1);
  std::filesystem::remove_all(std::filesystem::path(file).parent_path());
}
