#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <functional>
#include <list>
#include <memory>
#include <string>
#include <thread>

#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/read.hpp>
#include <boost/asio/write.hpp>

#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "sub_runtime.h"
#include "services/http_server/http_server_subservices.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// What forms the HTTP response of http-server-subservices.
//
// The same three rows are pinned in every runtime that implements this service
// (hkp-node, hkp-python, hkp-rt), because a board written against one must
// behave the same on the others:
//
//   | nested pipeline | service after the server | answer comes from |
//   |-----------------|--------------------------|-------------------|
//   | yes             | no                       | nested pipeline   |
//   | yes             | yes                      | nested pipeline   |
//   | no              | yes                      | the outer runtime |
//
// The middle row is the point: configuring a nested pipeline declares a
// handler, and services added behind the server must not silently rewrite what
// an external caller receives.
//
// Ported from hkp-node/tests/http-response-origin.test.ts.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

// Replaces whatever it receives with {"from": tag}, so the response says
// plainly which pipeline produced it.
class ReplacingService final : public Service {
public:
  ReplacingService(const std::string& id, std::string tag)
    : Service(id, "replacing"), m_tag(std::move(tag)) {}

  std::string getServiceId() const override { return "replacing"; }

  Data process(Data) override {
    return Data(json{{"from", m_tag}});
  }

private:
  std::string m_tag;
};

// Minimal RuntimeHost with a flat, ordered list of services (mirrors the one in
// service_sub_service.test.cpp).
class MockRuntimeHost final : public RuntimeHost {
public:
  using SvcList = std::list<std::shared_ptr<Service>>;
  SvcList services;

  std::function<std::shared_ptr<Service>(const std::string& serviceId,
                                         const std::string& instanceId)> factory;

  void addService(std::shared_ptr<Service> svc) {
    svc->setParentHost(*this);
    services.push_back(std::move(svc));
  }

  // Counts calls naming a service this host does not hold. Never REQUIRE here:
  // the server calls processFrom from its io thread, Catch2's macros are not
  // thread-safe, and a failing one throws — an exception escaping that thread
  // terminates the process instead of failing the test. Assert this on the test
  // thread instead.
  std::atomic<int> unknownServiceCalls{0};

  Data processFrom(const Service& svc, Data data,
                   bool advanceBefore,
                   std::function<void(Data)> callback) override {
    auto it = std::find_if(services.begin(), services.end(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
    if (it == services.end()) {
      ++unknownServiceCalls;
      return data;
    }

    for (auto next = advanceBefore ? std::next(it) : it;
         next != services.end(); ++next) {
      data = (*next)->startProcess(data);
      if (isNull(data)) break;
      if (isEarlyReturn(data)) { data = getControlFlowData(data); break; }
    }
    if (callback) callback(data);
    return data;
  }

  void scheduleProcessFrom(const Service& svc, Data data,
                           bool advanceBefore) override {
    processFrom(svc, data, advanceBefore, nullptr);
  }

  bool isConnected(const Service& svc) const override {
    return std::any_of(services.cbegin(), services.cend(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
  }

  void sendData(Data, MessagePurpose, const std::string&,
                std::function<void(Data)>) override {}

  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override {
    REQUIRE(factory);
    auto post = [](std::function<void()> fn) { fn(); };
    auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, factory, post);
    sr->populate(servicesConfig);
    return sr;
  }
};

// A one-shot HTTP GET, kept to plain asio so the test needs nothing the server
// does not already depend on. Returns the response body.
std::string httpGet(unsigned short port, const std::string& target) {
  namespace net = boost::asio;
  using tcp = net::ip::tcp;

  net::io_context ioc;
  tcp::socket socket(ioc);
  net::connect(socket, tcp::resolver(ioc).resolve("127.0.0.1", std::to_string(port)));

  const std::string request =
    "GET " + target + " HTTP/1.1\r\n"
    "Host: 127.0.0.1\r\n"
    "Connection: close\r\n"
    "\r\n";
  net::write(socket, net::buffer(request));

  std::string response;
  boost::system::error_code ec;
  char buffer[4096];
  for (;;) {
    const std::size_t n = socket.read_some(net::buffer(buffer), ec);
    if (ec) break;
    response.append(buffer, n);
  }

  const auto headerEnd = response.find("\r\n\r\n");
  return headerEnd == std::string::npos ? std::string()
                                        : response.substr(headerEnd + 4);
}

// Builds a runtime holding a server (optionally with a nested pipeline) plus
// whatever should follow it, and returns the port it ended up on.
struct Endpoint {
  MockRuntimeHost host;
  std::shared_ptr<HttpServerSubservices> server;

  // With a nested pipeline the service answers the caller *before* running the
  // services behind it, so httpGet can return — and this object can start being
  // destroyed — while the server's io thread is still inside processFrom,
  // walking a service list going out from under it. Bypassing stops the server
  // and joins that thread, and a destructor body runs before any member is
  // destroyed, so by the time `host` goes there is nothing left in flight.
  ~Endpoint() {
    if (server) {
      server->configure(Data(json{{"bypass", true}}));
    }
  }

  unsigned short port() const {
    return server->getState().value("port", static_cast<unsigned short>(0));
  }
};

std::shared_ptr<Endpoint> serve(bool withSubservices, bool withOuterService) {
  auto endpoint = std::make_shared<Endpoint>();

  endpoint->host.factory = [](const std::string&, const std::string& instanceId)
    -> std::shared_ptr<Service> {
    return std::make_shared<ReplacingService>(instanceId, "subservice");
  };

  endpoint->server = std::make_shared<HttpServerSubservices>("http-1");
  endpoint->host.addService(endpoint->server);
  if (withOuterService) {
    endpoint->host.addService(std::make_shared<ReplacingService>("outer-1", "outer"));
  }

  json pipeline = json::array();
  if (withSubservices) {
    pipeline.push_back(json{{"instanceId", "inner"}, {"serviceId", "replacing"}});
  }

  // Port 0 asks the OS for a free one, so tests never collide.
  endpoint->server->configure(Data(json{
    {"port", 0},
    {"mode", "process_on_session"},
    {"pipeline", pipeline},
    {"bypass", true},
  }));
  endpoint->server->configure(Data(json{{"bypass", false}}));

  return endpoint;
}

} // namespace

TEST_CASE("the nested pipeline answers when it is the only handler",
          "[http-server-subservices]") {
  auto endpoint = serve(/*withSubservices=*/true, /*withOuterService=*/false);
  REQUIRE(endpoint->port() != 0);
  REQUIRE(httpGet(endpoint->port(), "/") == R"({"from":"subservice"})");
  REQUIRE(endpoint->host.unknownServiceCalls == 0);
}

TEST_CASE("the nested pipeline still answers when services follow the server",
          "[http-server-subservices]") {
  // The outer service runs — it is a side effect of having served a request —
  // but it does not get to rewrite the answer.
  auto endpoint = serve(/*withSubservices=*/true, /*withOuterService=*/true);
  REQUIRE(endpoint->port() != 0);
  REQUIRE(httpGet(endpoint->port(), "/") == R"({"from":"subservice"})");
  REQUIRE(endpoint->host.unknownServiceCalls == 0);
}

TEST_CASE("the outer runtime answers when there is no nested pipeline",
          "[http-server-subservices]") {
  // Inversion of control: with no handler configured, the rest of the board is
  // the handler.
  auto endpoint = serve(/*withSubservices=*/false, /*withOuterService=*/true);
  REQUIRE(endpoint->port() != 0);
  REQUIRE(httpGet(endpoint->port(), "/") == R"({"from":"outer"})");
}
