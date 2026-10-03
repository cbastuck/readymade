#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <app.h>
#include <service.h>
#include <types/data.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// What a runtime says, heard by something other than the clients watching it.
//
// A runtime's output goes to the sockets bound to it. A runtime that belongs to
// a deployed board has one more listener — the connection to the board's
// coordinator — and that listener is not a socket this server accepted. The
// sink is where it listens, and `setRuntimeState` is how it changes what the
// runtime records without rebuilding it.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

class PassThrough final : public Service {
public:
  explicit PassThrough(const std::string& instanceId)
    : Service(instanceId, serviceId()) {}
  static std::string serviceId() { return "pass-through"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data data) override { return data; }
};

std::shared_ptr<App> appWithRuntime(json state = json::object()) {
  auto app = std::make_shared<App>();
  app->registerService<PassThrough>();
  app->createRuntime(json{
    {"id", "rt-1"},
    {"name", "Runtime"},
    {"state", state},
    {"services", json::array({
      json{{"serviceId", PassThrough::serviceId()}, {"uuid", "svc-1"}},
    })},
  });
  return app;
}

// The sink is called on the app's event loop, so a test waits for it.
bool eventually(const std::function<bool()>& check) {
  for (int i = 0; i < 200; ++i) {
    if (check()) {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  return check();
}

struct Heard {
  std::mutex mutex;
  std::vector<json> results;
  std::vector<std::string> events;

  App::RuntimeOutputSink sink() {
    return App::RuntimeOutputSink{
      [this](const Data& data, MessagePurpose purpose, const std::string&) {
        if (purpose == MessagePurpose::NOTIFICATION) {
          return;
        }
        std::lock_guard<std::mutex> lock(mutex);
        const auto asJson = getJSONFromData(data);
        results.push_back(asJson ? *asJson : json(nullptr));
      },
      [this](const LogEntry& entry) {
        std::lock_guard<std::mutex> lock(mutex);
        events.push_back(entry.event);
      },
    };
  }
  size_t resultCount() {
    std::lock_guard<std::mutex> lock(mutex);
    return results.size();
  }
  size_t eventCount() {
    std::lock_guard<std::mutex> lock(mutex);
    return events.size();
  }
};

} // namespace

TEST_CASE("a runtime's result reaches its sink as the value it was",
          "[runtime][sink]") {
  auto app = appWithRuntime();
  Heard heard;
  app->setRuntimeOutputSink("rt-1", heard.sink());

  app->processRuntime("rt-1", Data(json{{"n", 1}}));

  REQUIRE(eventually([&] { return heard.resultCount() == 1; }));
  REQUIRE(heard.results[0] == json{{"n", 1}});
}

TEST_CASE("a sink hears only the runtime it was set for", "[runtime][sink]") {
  auto app = appWithRuntime();
  app->createRuntime(json{
    {"id", "rt-2"}, {"name", "Other"}, {"services", json::array()},
  });
  Heard heard;
  app->setRuntimeOutputSink("rt-2", heard.sink());

  app->processRuntime("rt-1", Data(json{{"n", 1}}));
  app->processRuntime("rt-2", Data(json{{"n", 2}}));

  REQUIRE(eventually([&] { return heard.resultCount() == 1; }));
  REQUIRE(heard.results[0] == json{{"n", 2}});
}

TEST_CASE("a cleared sink hears nothing more", "[runtime][sink]") {
  auto app = appWithRuntime();
  Heard heard;
  app->setRuntimeOutputSink("rt-1", heard.sink());
  app->processRuntime("rt-1", Data(json{{"n", 1}}));
  REQUIRE(eventually([&] { return heard.resultCount() == 1; }));

  app->clearRuntimeOutputSink("rt-1");
  app->processRuntime("rt-1", Data(json{{"n", 2}}));
  std::this_thread::sleep_for(std::chrono::milliseconds(100));

  REQUIRE(heard.resultCount() == 1);
}

TEST_CASE("a sink outlives the runtime being rebuilt under its id",
          "[runtime][sink]") {
  // A coordinator builds a runtime by replacing whatever holds its id, and
  // goes on listening over the same connection.
  auto app = appWithRuntime();
  Heard heard;
  app->setRuntimeOutputSink("rt-1", heard.sink());

  app->removeRuntime("rt-1");
  app->createRuntime(json{
    {"id", "rt-1"}, {"name", "Rebuilt"}, {"services", json::array()},
  });
  app->processRuntime("rt-1", Data(json{{"n", 3}}));

  REQUIRE(eventually([&] { return heard.resultCount() == 1; }));
}

TEST_CASE("what a runtime records can be changed while it runs",
          "[runtime][state]") {
  auto app = appWithRuntime();

  auto settings = app->setRuntimeState(
    "rt-1", json{{"logging", true}, {"logLevel", "debug"}});

  REQUIRE(settings["logging"] == true);
  REQUIRE(settings["logLevel"] == "debug");
  // Not mentioned, so left as it was.
  REQUIRE(settings["logData"] == true);

  auto later = app->setRuntimeState("rt-1", json{{"logData", false}});
  REQUIRE(later["logging"] == true);
  REQUIRE(later["logData"] == false);
}

TEST_CASE("changing what a runtime that is not there records says so",
          "[runtime][state]") {
  auto app = appWithRuntime();

  REQUIRE(app->setRuntimeState("nope", json{{"logging", true}}).is_null());
}

TEST_CASE("entries reach the sink once logging is switched on",
          "[runtime][sink][state]") {
  auto app = appWithRuntime();
  Heard heard;
  app->setRuntimeOutputSink("rt-1", heard.sink());

  app->processRuntime("rt-1", Data(json{{"n", 1}}));
  REQUIRE(eventually([&] { return heard.resultCount() == 1; }));
  REQUIRE(heard.eventCount() == 0);

  app->setRuntimeState("rt-1", json{{"logging", true}, {"logLevel", "debug"}});
  app->processRuntime("rt-1", Data(json{{"n", 2}}));

  REQUIRE(eventually([&] { return heard.eventCount() > 0; }));
}
