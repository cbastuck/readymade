#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <app.h>
#include <service.h>
#include <types/data.h>

#include "process_context.h"
#include "runtime_host.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Which run work belongs to, when it is not simply the call in progress: what a
// service does by itself, what it does from a thread of its own, and what it
// does after a call it deferred has ended.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

// A test reaches the services an app built by the id it gave them.
std::mutex g_instancesMutex;
std::map<std::string, Service*> g_instances;

template <class T>
T& instance(const std::string& id) {
  std::lock_guard<std::mutex> lock(g_instancesMutex);
  return *static_cast<T*>(g_instances.at(id));
}

void remember(const std::string& id, Service* service) {
  std::lock_guard<std::mutex> lock(g_instancesMutex);
  g_instances[id] = service;
}

// Emits and reports when a test says so, the way a timer or a meter does when
// nobody called it.
class Source final : public Service {
public:
  explicit Source(const std::string& instanceId)
    : Service(instanceId, serviceId()) { remember(instanceId, this); }
  static std::string serviceId() { return "context-source"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data data) override { return data; }

  void emitNow(int n) { next(Data(json{{"n", n}})); }
  void report(int n) { sendNotification(json{{"level", n}}); }
};

// Records the run it was called in.
class Spy final : public Service {
public:
  explicit Spy(const std::string& instanceId)
    : Service(instanceId, serviceId()) { remember(instanceId, this); }
  static std::string serviceId() { return "context-spy"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data data) override {
    const auto* run = parentHost() ? parentHost()->currentContext() : nullptr;
    std::lock_guard<std::mutex> lock(mutex);
    runIds.push_back(run ? run->runId : "");
    actors.push_back(run ? run->actorKind() : "none");
    return data;
  }
  std::mutex mutex;
  std::vector<std::string> runIds;
  std::vector<std::string> actors;
};

// Holds its call open until a test lets it go, so another can overlap it.
class Gate final : public Service {
public:
  explicit Gate(const std::string& instanceId)
    : Service(instanceId, serviceId()) { remember(instanceId, this); }
  static std::string serviceId() { return "context-gate"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data data) override {
    std::unique_lock<std::mutex> lock(mutex);
    entered = true;
    changed.notify_all();
    changed.wait_for(lock, std::chrono::seconds(5), [this] { return released; });
    return data;
  }
  bool waitEntered() {
    std::unique_lock<std::mutex> lock(mutex);
    return changed.wait_for(lock, std::chrono::seconds(5), [this] { return entered; });
  }
  void release() {
    std::lock_guard<std::mutex> lock(mutex);
    released = true;
    changed.notify_all();
  }
  std::mutex mutex;
  std::condition_variable changed;
  bool entered = false;
  bool released = false;
};

// Defers every call, and ends it when a test says how.
class Deferring final : public Service {
public:
  explicit Deferring(const std::string& instanceId)
    : Service(instanceId, serviceId()) { remember(instanceId, this); }
  static std::string serviceId() { return "context-deferring"; }
  std::string getServiceId() const override { return serviceId(); }
  Data process(Data) override { return deferCompletion(); }

  void endWithNothing() { endDeferred(); }
  void endWith(int n) { emit(Data(json{{"n", n}})); }
  void report(int n) { sendNotification(json{{"level", n}}); }
};

struct Said {
  std::string sender;
  json payload;
  std::string actor;
  std::string runId;
};

// Declared before the app in every test, so that it is destroyed after it.
struct Heard {
  std::mutex mutex;
  std::vector<Said> notifications;
  std::vector<Said> results;

  App::RuntimeOutputSink sink() {
    return App::RuntimeOutputSink{
      [this](const Data& data, MessagePurpose purpose, const std::string& sender,
             const ProcessContext* run) {
        const auto asJson = getJSONFromData(data);
        Said said{sender, asJson ? *asJson : json(nullptr),
                  run ? run->actorKind() : "none", run ? run->runId : ""};
        std::lock_guard<std::mutex> lock(mutex);
        (purpose == MessagePurpose::NOTIFICATION ? notifications : results)
          .push_back(std::move(said));
      },
      [](const LogEntry&) {},
    };
  }

  // What a service reported itself, leaving out the flow the runtime reports.
  std::vector<Said> reports(const std::string& sender) {
    std::lock_guard<std::mutex> lock(mutex);
    std::vector<Said> own;
    for (const auto& said : notifications) {
      if (said.sender == sender && !said.payload.contains("__internal"))
        own.push_back(said);
    }
    return own;
  }

  std::vector<Said> finished(const std::string& sender) {
    std::lock_guard<std::mutex> lock(mutex);
    std::vector<Said> own;
    for (const auto& said : notifications) {
      if (said.sender == sender && said.payload.contains("__internal") &&
          said.payload["__internal"].value("state", "") == "call-process-finished")
        own.push_back(said);
    }
    return own;
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

std::shared_ptr<App> appWith(const json& services, json state = json::object()) {
  auto app = std::make_shared<App>();
  app->registerService<Source>();
  app->registerService<Spy>();
  app->registerService<Gate>();
  app->registerService<Deferring>();
  app->createRuntime(json{
    {"id", "rt-1"}, {"name", "Runtime"}, {"state", state}, {"services", services},
  });
  return app;
}

json service(const std::string& serviceId, const std::string& uuid) {
  return json{{"serviceId", serviceId}, {"uuid", uuid}};
}

ProcessContext personRun(const std::string& sub) {
  auto run = ProcessContext::newRun();
  run.runId = "run-of-" + sub;
  run.actor = PersonRunActor{Caller{sub, "", ""}, ProcessContext::nowMs() + 60'000};
  return run;
}

} // namespace

TEST_CASE("what a runtime emits by itself is board work in one standing run",
          "[runtime][context][autonomous]") {
  // An identity per emission is an id and its allocations per audio buffer.
  // Nothing reads it unless a log is kept, so none is made.
  Heard heard;
  auto app = appWith(json::array({
    service(Source::serviceId(), "source"), service(Spy::serviceId(), "spy"),
  }));
  app->setRuntimeOutputSink("rt-1", heard.sink());
  auto& source = instance<Source>("source");
  auto& spy = instance<Spy>("spy");

  source.emitNow(1);
  source.emitNow(2);
  source.report(1);
  source.report(2);

  REQUIRE(spy.actors == std::vector<std::string>{"board", "board"});
  REQUIRE_FALSE(spy.runIds[0].empty());
  REQUIRE(spy.runIds[0] == spy.runIds[1]);
  REQUIRE(eventually([&] { return heard.reports("source").size() == 2; }));
  for (const auto& said : heard.reports("source")) {
    REQUIRE(said.actor == "board");
    REQUIRE(said.runId == spy.runIds[0]);
  }
  REQUIRE(eventually([&] {
    std::lock_guard<std::mutex> lock(heard.mutex);
    return heard.results.size() == 2;
  }));
  REQUIRE(heard.results[0].actor == "board");
}

TEST_CASE("each emission is a run of its own once a board keeps a log",
          "[runtime][context][autonomous]") {
  auto app = appWith(json::array({
    service(Source::serviceId(), "source"), service(Spy::serviceId(), "spy"),
  }), json{{"logging", true}, {"logLevel", "debug"}});
  auto& source = instance<Source>("source");
  auto& spy = instance<Spy>("spy");

  source.emitNow(1);
  source.emitNow(2);

  REQUIRE(spy.actors == std::vector<std::string>{"board", "board"});
  REQUIRE_FALSE(spy.runIds[0].empty());
  REQUIRE(spy.runIds[0] != spy.runIds[1]);
}

TEST_CASE("a call on one thread is not the run of work on another",
          "[runtime][context][threads]") {
  // A person's pass is inside a service on one thread while a source reports,
  // emits and is configured from others. Kept on the runtime, the person's run
  // would be what all of that was said in — and what was left behind when the
  // calls returned out of order.
  Heard heard;
  auto app = appWith(json::array({
    service(Source::serviceId(), "source"), service(Gate::serviceId(), "gate"),
    service(Spy::serviceId(), "spy"),
  }));
  app->setRuntimeOutputSink("rt-1", heard.sink());
  auto& source = instance<Source>("source");
  auto& gate = instance<Gate>("gate");
  auto& spy = instance<Spy>("spy");
  const auto anna = personRun("auth0|anna");

  std::thread passing([&] {
    app->processRuntimeAs("rt-1", Data(json{{"n", 1}}), anna);
  });
  REQUIRE(gate.waitEntered());

  // While Anna's pass is held open.
  source.report(1);
  const auto owner = personRun("auth0|owner");
  app->configureService("rt-1", "source", json::object(), "", &owner);

  gate.release();
  passing.join();
  source.report(2);

  REQUIRE(eventually([&] { return heard.reports("source").size() == 2; }));
  for (const auto& said : heard.reports("source")) {
    REQUIRE(said.actor == "board");
  }
  // Her pass went on as hers, and left nothing of itself for what came after.
  REQUIRE(spy.actors == std::vector<std::string>{"person"});
  REQUIRE(spy.runIds[0] == "run-of-auth0|anna");
  instance<Gate>("gate").released = true;
  source.emitNow(3);
  REQUIRE(spy.actors.back() == "board");
}

TEST_CASE("a deferred call that ends with nothing gives its run back",
          "[runtime][context][deferred]") {
  // The worker failed, or had nothing to pass on: no emit() ever consumes the
  // run the call was made in. Left in place, everything the service said from
  // then on would be said as the person who made that one call.
  Heard heard;
  auto app = appWith(json::array({
    service(Deferring::serviceId(), "deferring"), service(Spy::serviceId(), "spy"),
  }));
  app->setRuntimeOutputSink("rt-1", heard.sink());
  auto& deferring = instance<Deferring>("deferring");
  auto& spy = instance<Spy>("spy");

  app->processRuntimeAs("rt-1", Data(json{{"n", 1}}), personRun("auth0|anna"));
  deferring.report(1);
  std::thread worker([&] { deferring.endWithNothing(); });
  worker.join();
  deferring.report(2);
  // Ending it twice says nothing more.
  deferring.endWithNothing();

  REQUIRE(eventually([&] { return heard.reports("deferring").size() == 2; }));
  const auto reports = heard.reports("deferring");
  REQUIRE(reports[0].actor == "person");
  REQUIRE(reports[1].actor == "board");
  // The bracket the call opened is closed, once, in the run it was made in.
  REQUIRE(eventually([&] { return heard.finished("deferring").size() == 1; }));
  REQUIRE(heard.finished("deferring")[0].actor == "person");
  // And nothing was passed on.
  REQUIRE(spy.actors.empty());
}

TEST_CASE("a deferred answer continues the run its call was made in, once",
          "[runtime][context][deferred]") {
  Heard heard;
  auto app = appWith(json::array({
    service(Deferring::serviceId(), "deferring"), service(Spy::serviceId(), "spy"),
  }));
  app->setRuntimeOutputSink("rt-1", heard.sink());
  auto& deferring = instance<Deferring>("deferring");
  auto& spy = instance<Spy>("spy");

  app->processRuntimeAs("rt-1", Data(json{{"n", 1}}), personRun("auth0|anna"));
  std::thread worker([&] {
    deferring.endWith(1);
    // A standing arrangement from here on, not her call.
    deferring.endWith(2);
    deferring.endWithNothing();
  });
  worker.join();

  REQUIRE(spy.actors == std::vector<std::string>{"person", "board"});
  REQUIRE(spy.runIds[0] == "run-of-auth0|anna");
}
