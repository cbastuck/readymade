#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <string>
#include <thread>

#include <app.h>
#include <service.h>
#include <types/data.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// A one-shot a call starts: the timer answers the call at once and fires later,
// from a thread of its own. What is still waiting belongs to the service, and
// ends with it.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

// Outlives every app here, so a tick arriving late still has somewhere to land.
std::atomic<int> g_ticks{0};

// Counts the ticks that reach it, and not the call a timer passes through.
class TickCounter final : public Service {
public:
  explicit TickCounter(const std::string& instanceId)
    : Service(instanceId, serviceId()) {}
  static std::string serviceId() { return "timer-tick-counter"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data data) override {
    const auto asJson = getJSONFromData(data);
    if (asJson && asJson->contains("triggerCount")) {
      ++g_ticks;
    }
    return data;
  }
};

bool eventually(const std::function<bool()>& check) {
  for (int i = 0; i < 200; ++i) {
    if (check()) {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  return check();
}

// A runtime whose timer has nothing pending: a timer fires once by itself when
// it is loaded, and that tick is waited for and left out of the count.
std::shared_ptr<App> appWithOneShot(int delayMs) {
  g_ticks = 0;
  auto app = std::make_shared<App>();
  app->registerService<TickCounter>();
  app->createRuntime(json{
    {"id", "rt-1"}, {"name", "Runtime"},
    {"services", json::array({
      json{{"serviceId", "timer"}, {"uuid", "clock"}},
      json{{"serviceId", TickCounter::serviceId()}, {"uuid", "counter"}},
    })},
  });
  app->configureService("rt-1", "clock", json{
    {"periodic", false}, {"oneShotDelay", delayMs}, {"oneShotDelayUnit", "ms"},
  });
  REQUIRE(eventually([] { return g_ticks == 1; }));
  g_ticks = 0;
  return app;
}

} // namespace

TEST_CASE("a call starts a one-shot that fires once, after the call returned",
          "[services][timer]") {
  auto app = appWithOneShot(20);

  app->processRuntime("rt-1", Data(json{{"go", true}}));
  REQUIRE(g_ticks == 0);

  REQUIRE(eventually([] { return g_ticks == 1; }));
  std::this_thread::sleep_for(std::chrono::milliseconds(60));
  REQUIRE(g_ticks == 1);
}

TEST_CASE("every call starts a one-shot of its own", "[services][timer]") {
  auto app = appWithOneShot(20);

  app->processRuntime("rt-1", Data(json{{"go", 1}}));
  app->processRuntime("rt-1", Data(json{{"go", 2}}));
  app->processRuntime("rt-1", Data(json{{"go", 3}}));

  REQUIRE(eventually([] { return g_ticks == 3; }));
}

TEST_CASE("a one-shot still waiting when its runtime is removed never fires",
          "[services][timer][teardown]") {
  // Regression: the wait ran on a detached thread, which woke into a timer
  // that was no longer there.
  auto app = appWithOneShot(100);

  app->processRuntime("rt-1", Data(json{{"go", true}}));
  REQUIRE(app->removeRuntime("rt-1"));

  std::this_thread::sleep_for(std::chrono::milliseconds(300));
  REQUIRE(g_ticks == 0);
}

TEST_CASE("a one-shot still waiting when the app goes never fires",
          "[services][timer][teardown]") {
  auto app = appWithOneShot(100);

  app->processRuntime("rt-1", Data(json{{"go", true}}));
  app.reset();

  std::this_thread::sleep_for(std::chrono::milliseconds(300));
  REQUIRE(g_ticks == 0);
}
