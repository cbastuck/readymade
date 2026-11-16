#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers.hpp>
#include <catch2/matchers/catch_matchers_exception.hpp>

#include <deque>

#include "nested_fixture.h"
#include "services/loop.h"

using namespace hkp;
using nested_fixture::NestedHost;

// ──────────────────────────────────────────────────────────────────────────────
// Repetition as a service.
//
// The same cases as hkp-python's loop tests, where the two agree: what each
// round is given, when a loop ends and why, what a call with nothing does.
// Where they differ is pinned too — a run here answers its call with nothing
// and hands its result on afterwards, one round per turn of the event loop.
// ──────────────────────────────────────────────────────────────────────────────
namespace {

// `{ n }` becomes `{ n + 1 }`; null for `stopOn`, a throw for `failOn`.
class Counter final : public Service {
public:
  explicit Counter(const std::string& id, json state = json::object())
    : Service(id, "counter"), state(std::move(state)) {}

  std::string getServiceId() const override { return "counter"; }

  Data process(Data data) override {
    auto j = getJSONFromData(data);
    if (!j) return data;
    if (before) before(*j);
    seen.push_back(*j);
    if (state.contains("failOn") && state["failOn"] == *j)
      throw std::runtime_error("malformed");
    if (state.contains("stopOn") && state["stopOn"] == *j)
      return Null();
    return json{{"n", (*j)["n"].get<int>() + 1}};
  }

  json state;
  std::vector<json> seen;
  std::function<void(const json&)> before;
};

// What the loop handed on to the service after it.
class Collector final : public Service {
public:
  explicit Collector(const std::string& id) : Service(id, "collector") {}
  std::string getServiceId() const override { return "collector"; }
  Data process(Data data) override {
    if (auto j = getJSONFromData(data)) received.push_back(*j);
    return data;
  }
  std::vector<json> received;
};

struct Fixture {
  NestedHost host;
  std::shared_ptr<Loop> loop = std::make_shared<Loop>("loop-1");
  std::shared_ptr<Counter> counter;
  std::shared_ptr<Collector> after = std::make_shared<Collector>("after");

  explicit Fixture(json state = json::object(), json nested = json::object()) {
    counter = std::make_shared<Counter>("inner-1", nested);
    host.addService(loop);
    host.addService(after);
    host.instances["inner-1"] = counter;
    state["pipeline"] = json::array({json{{"serviceId", "counter"}, {"instanceId", "inner-1"}}});
    loop->configure(state);
    // What configuring said is not what a round reports.
    host.notifications.clear();
  }

  // What the call itself answered.
  json call(Data input = Undefined()) {
    auto out = loop->startProcess(input);
    if (isNull(out)) return nullptr;
    auto j = getJSONFromData(out);
    REQUIRE(j.has_value());
    return *j;
  }

  // A run answers its call with nothing; what it produced is what the service
  // after it was handed.
  json run(Data input = Undefined()) {
    after->received.clear();
    REQUIRE(call(input).is_null());
    return after->received.empty() ? json(nullptr) : after->received.back();
  }
};

} // namespace

TEST_CASE("Loop gives each round what the round before returned", "[loop]")
{
  Fixture f(json{{"maxRounds", 3}});
  REQUIRE(f.run(json{{"n", 0}}) == json{{"n", 3}});
  REQUIRE(f.counter->seen == std::vector<json>{{{"n", 0}}, {{"n", 1}}, {{"n", 2}}});
  // Handed on once, at the end — not once per round.
  REQUIRE(f.after->received.size() == 1);
}

TEST_CASE("Loop ends when the condition holds on a round's output", "[loop]")
{
  Fixture f(json{{"until", "params.n >= 2"}});
  REQUIRE(f.run(json{{"n", 0}}) == json{{"n", 2}});
  REQUIRE(f.counter->seen.size() == 2);
  auto state = f.loop->getState();
  REQUIRE(state["done"] == true);
  REQUIRE(state["reason"] == "until");
  REQUIRE(state["round"] == 2);
  REQUIRE(state["running"] == false);
}

TEST_CASE("Loop ends at the limit, and says that is why", "[loop]")
{
  Fixture f(json{{"until", "params.n >= 50"}, {"maxRounds", 4}});
  REQUIRE(f.run(json{{"n", 0}}) == json{{"n", 4}});
  REQUIRE(f.loop->getState()["reason"] == "maxRounds");
}

TEST_CASE("Loop reports every round with its output", "[loop]")
{
  Fixture f(json{{"maxRounds", 2}});
  f.run(json{{"n", 0}});
  REQUIRE(f.host.notifications == std::vector<json>{
    json{{"round", 1}, {"done", false}, {"reason", ""}, {"output", {{"n", 1}}}},
    json{{"round", 2}, {"done", true}, {"reason", "maxRounds"}, {"output", {{"n", 2}}}},
  });
}

TEST_CASE("Loop steps one round per call, and a call with nothing carries on", "[loop]")
{
  Fixture f(json{{"mode", "step"}, {"until", "params.n >= 3"}});
  REQUIRE(f.call(json{{"n", 0}}) == json{{"n", 1}});
  REQUIRE(f.call() == json{{"n", 2}});
  // What a facade button with no payload sends is nothing too.
  REQUIRE(f.call(json(nullptr)) == json{{"n", 3}});
  REQUIRE(f.loop->getState()["done"] == true);
  // Done: a further step has nothing to do, and passes nothing on.
  REQUIRE(f.call().is_null());
  REQUIRE(f.counter->seen.size() == 3);
}

TEST_CASE("Loop that was stepped can be run to its end", "[loop]")
{
  Fixture f(json{{"mode", "step"}, {"until", "params.n >= 5"}});
  f.call(json{{"n", 0}});
  f.loop->configure(json{{"mode", "run"}});
  REQUIRE(f.run() == json{{"n", 5}});
  REQUIRE(f.counter->seen.size() == 5);
}

TEST_CASE("Loop starts over with a value, and does nothing with none to start from", "[loop]")
{
  Fixture f(json{{"until", "params.n >= 2"}});
  REQUIRE(f.run().is_null());
  REQUIRE(f.counter->seen.empty());

  f.run(json{{"n", 0}});
  REQUIRE(f.run(json{{"n", 10}}) == json{{"n", 11}});
  REQUIRE(f.loop->getState()["round"] == 1);
}

TEST_CASE("Loop stops between rounds and can be carried on", "[loop]")
{
  Fixture f(json{{"maxRounds", 10}});
  // Stop arrives as a configure while the third round is running.
  f.counter->before = [&](const json& value) {
    if (value["n"] == 2) f.loop->configure(json{{"stop", true}});
  };
  REQUIRE(f.run(json{{"n", 0}}) == json{{"n", 3}});
  auto state = f.loop->getState();
  REQUIRE(state["done"] == false);
  REQUIRE(state["reason"] == "stopped");
  REQUIRE(state["running"] == false);

  f.counter->before = nullptr;
  REQUIRE(f.run() == json{{"n", 10}});
  REQUIRE(f.host.notifications.back()["reason"] == "maxRounds");
}

TEST_CASE("Loop ends with the last value when its pipeline stops", "[loop]")
{
  Fixture f(json::object(), json{{"stopOn", {{"n", 2}}}});
  REQUIRE(f.run(json{{"n", 0}}) == json{{"n", 2}});
  REQUIRE(f.loop->getState()["reason"] == "ended");

  // In the first round there is no last value: nothing is passed on.
  Fixture g(json::object(), json{{"stopOn", {{"n", 0}}}});
  REQUIRE(g.run(json{{"n", 0}}).is_null());
  REQUIRE(g.host.notifications == std::vector<json>{
    json{{"round", 0}, {"done", true}, {"reason", "ended"}}});
}

TEST_CASE("Loop ends a run on a failing round, keeping the value before it", "[loop]")
{
  Fixture f(json{{"until", "params.n >= 4"}}, json{{"failOn", {{"n", 2}}}});
  REQUIRE(f.run(json{{"n", 0}}).is_null());
  auto state = f.loop->getState();
  REQUIRE(state["round"] == 2);
  REQUIRE(state["running"] == false);
  REQUIRE(state["done"] == false);
  REQUIRE(state["reason"] == "failed");
  REQUIRE(f.host.logged == std::vector<std::string>{"error service.failed"});
  REQUIRE(f.host.notifications.back()["error"] == "malformed");

  // Carried on once what failed is put right.
  f.counter->state.erase("failOn");
  REQUIRE(f.run() == json{{"n", 4}});

  // A step that fails throws, as any service does.
  Fixture g(json{{"mode", "step"}}, json{{"failOn", {{"n", 0}}}});
  REQUIRE_THROWS_WITH(g.loop->startProcess(json{{"n", 0}}), "malformed");
}

TEST_CASE("Loop drops what it holds on reset", "[loop]")
{
  Fixture f(json{{"mode", "step"}});
  f.call(json{{"n", 0}});
  f.loop->configure(json{{"reset", true}});
  REQUIRE(f.call().is_null());
  REQUIRE(f.loop->getState()["round"] == 0);
}

TEST_CASE("Loop refuses a condition that does not parse", "[loop]")
{
  Fixture f;
  REQUIRE_THROWS(f.loop->configure(json{{"until", "params.n >="}}));
  REQUIRE(f.loop->getState()["until"] == "");
}

TEST_CASE("Loop takes one round per turn of the event loop", "[loop]")
{
  // What makes a run stoppable: between two rounds the loop is not on the
  // thread, so whatever else is waiting for it gets its turn.
  struct Queued final : RuntimeHost {
    NestedHost inner;
    std::deque<std::function<void()>> queue;
    Data processFrom(const Service& s, Data d, bool a, std::function<void(Data)> c) override { return inner.processFrom(s, d, a, c); }
    void scheduleProcessFrom(const Service& s, Data d, bool a) override { inner.processFrom(s, d, a, nullptr); }
    void post(std::function<void()> fn) override { queue.push_back(std::move(fn)); }
    bool isConnected(const Service&) const override { return true; }
    void sendData(Data d, MessagePurpose p, const std::string& id, std::function<void(Data)> c) override { inner.sendData(d, p, id, c); }
    void notifyProcessFinished(const Service&, const Data&) override {}
    void log(const Service&, LogLevel, const std::string&, const nlohmann::json&) override {}
    void forwardLog(const LogEntry&) override {}
    SecretVault& secrets() override { return inner.secrets(); }
    SlotStore& slots() override { return inner.slots(); }
    std::shared_ptr<SubRuntime> createSubRuntime(const Service& owner, const json& config) override {
      return inner.createSubRuntime(owner, config);
    }
  } host;

  auto loop = std::make_shared<Loop>("loop-1");
  auto counter = std::make_shared<Counter>("inner-1");
  loop->setParentHost(host);
  host.inner.services.push_back(loop);
  host.inner.instances["inner-1"] = counter;
  loop->configure(json{
    {"maxRounds", 0},
    {"pipeline", json::array({json{{"serviceId", "counter"}, {"instanceId", "inner-1"}}})}});

  REQUIRE(isNull(loop->startProcess(json{{"n", 0}})));
  REQUIRE(counter->seen.empty());
  REQUIRE(loop->getState()["running"] == true);

  for (int turn = 0; turn < 3; ++turn)
  {
    REQUIRE(host.queue.size() == 1);
    auto next = std::move(host.queue.front());
    host.queue.pop_front();
    next();
  }
  REQUIRE(counter->seen.size() == 3);

  // No limit and no condition: only Stop ends it, and it does.
  loop->configure(json{{"stop", true}});
  auto next = std::move(host.queue.front());
  host.queue.pop_front();
  next();
  REQUIRE(host.queue.empty());
  REQUIRE(counter->seen.size() == 3);
  REQUIRE(loop->getState()["reason"] == "stopped");
  REQUIRE(loop->getState()["running"] == false);
}

TEST_CASE("Loop with nothing in it, or bypassed, passes its input through", "[loop]")
{
  NestedHost host;
  auto empty = std::make_shared<Loop>("loop-1");
  host.addService(empty);
  empty->configure(json{{"pipeline", json::array()}});
  REQUIRE(*getJSONFromData(empty->startProcess(json{{"n", 0}})) == json{{"n", 0}});

  Fixture f(json{{"bypass", true}});
  REQUIRE(f.call(json{{"n", 0}}) == json{{"n", 0}});
  REQUIRE(f.counter->seen.empty());
}

TEST_CASE("Loop reports what it repeats beside its pipeline", "[loop]")
{
  Fixture f(json{{"until", "params.done"}, {"maxRounds", 7}, {"mode", "step"}});
  auto state = f.loop->getState();
  REQUIRE(state["until"] == "params.done");
  REQUIRE(state["maxRounds"] == 7);
  REQUIRE(state["mode"] == "step");
  REQUIRE(state["pipeline"][0]["instanceId"] == "inner-1");
  REQUIRE(Loop::serviceId() == "loop");
}
