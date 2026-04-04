#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <functional>
#include <list>
#include <map>
#include <memory>
#include <string>

#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "sub_runtime.h"
#include "services/sub_service.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────────────────────────────────────
namespace {

// Appends m_tag to JSON["trace"] and records call count / last input.
class RecordingService final : public Service {
public:
  explicit RecordingService(const std::string& id, std::string tag = "")
    : Service(id, "recording"), m_tag(std::move(tag)) {}

  std::string getServiceId() const override { return "recording"; }

  Data process(Data data) override {
    ++callCount;
    lastInput = data;
    auto j = getJSONFromData(data);
    if (j) {
      (*j)["trace"].push_back(m_tag);
      return *j;
    }
    return data;
  }

  std::string m_tag;
  int callCount = 0;
  Data lastInput = Undefined();
};

// Immediately delegates processing downstream via next() and returns whatever
// the downstream chain returns.
class NextCallerService final : public Service {
public:
  explicit NextCallerService(const std::string& id)
    : Service(id, "next-caller") {}

  std::string getServiceId() const override { return "next-caller"; }

  Data process(Data data) override {
    ++callCount;
    return next(data);
  }

  int callCount = 0;
};

// Calls emit() with the input data (plus an "emitted" flag) then returns Null
// so the normal pipeline iteration stops.  Downstream sees exactly one call.
class EmitAndStopService final : public Service {
public:
  explicit EmitAndStopService(const std::string& id)
    : Service(id, "emit-and-stop") {}

  std::string getServiceId() const override { return "emit-and-stop"; }

  Data process(Data data) override {
    ++callCount;
    auto j = getJSONFromData(data);
    if (j) {
      (*j)["emitted"] = true;
      emit(*j);
    }
    return Null(); // stop normal pipeline propagation
  }

  int callCount = 0;
};

// Calls emit() three times (with an index) then returns Null.
class MultiEmitService final : public Service {
public:
  explicit MultiEmitService(const std::string& id)
    : Service(id, "multi-emit") {}

  std::string getServiceId() const override { return "multi-emit"; }

  Data process(Data data) override {
    ++callCount;
    auto j = getJSONFromData(data);
    if (!j) return data;
    for (int i = 0; i < 3; ++i) {
      auto copy = *j;
      copy["emission"] = i;
      emit(copy);
    }
    return Null();
  }

  int callCount = 0;
};

// Minimal RuntimeHost with a flat, ordered list of services.
class MockRuntimeHost final : public RuntimeHost {
public:
  using SvcList = std::list<std::shared_ptr<Service>>;
  SvcList services;

  // Provide before calling createSubRuntime (used by SubService).
  std::function<std::shared_ptr<Service>(const std::string& serviceId,
                                         const std::string& instanceId)> factory;

  void addService(std::shared_ptr<Service> svc) {
    svc->setParentHost(*this);
    services.push_back(std::move(svc));
  }

  // ── RuntimeHost ─────────────────────────────────────────────────────────────

  Data processFrom(const Service& svc, Data data,
                   bool advanceBefore,
                   std::function<void(Data)> callback) override {
    auto it = std::find_if(services.begin(), services.end(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
    REQUIRE(it != services.end());

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

// Convenience: build a SubRuntime from a pre-populated instance-id map.
std::shared_ptr<SubRuntime> makeSubRuntime(
    RuntimeHost& parent,
    const Service* ownerInParent,
    std::map<std::string, std::shared_ptr<Service>> instanceMap,
    const json& servicesConfig)
{
  auto factory = [instanceMap](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    auto it = instanceMap.find(id);
    return it != instanceMap.end() ? it->second : nullptr;
  };
  auto post = [](std::function<void()> fn) { fn(); };
  auto sr = std::make_shared<SubRuntime>(parent, ownerInParent, factory, post);
  sr->populate(servicesConfig);
  return sr;
}

} // namespace

// ──────────────────────────────────────────────────────────────────────────────
// SubRuntime::process — synchronous, no next()
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("SubRuntime::process passes data through all inner services in order",
          "[sub_runtime]")
{
  MockRuntimeHost host;
  auto anchor = std::make_shared<RecordingService>("anchor", "anchor");
  host.addService(anchor);

  auto recA = std::make_shared<RecordingService>("inner-a", "A");
  auto recB = std::make_shared<RecordingService>("inner-b", "B");

  auto sr = makeSubRuntime(host, anchor.get(),
    {{"inner-a", recA}, {"inner-b", recB}},
    json::array({
      {{"serviceId", "recording"}, {"instanceId", "inner-a"}},
      {{"serviceId", "recording"}, {"instanceId", "inner-b"}}
    }));

  json input = {{"trace", json::array()}};
  auto result = sr->process(input);

  REQUIRE(recA->callCount == 1);
  REQUIRE(recB->callCount == 1);

  auto j = getJSONFromData(result);
  REQUIRE(j.has_value());
  REQUIRE((*j)["trace"] == json::array({"A", "B"}));
}

TEST_CASE("SubRuntime::process stops at the first Null output",
          "[sub_runtime]")
{
  MockRuntimeHost host;
  auto anchor = std::make_shared<RecordingService>("anchor", "anchor");
  host.addService(anchor);

  struct NullService final : public Service {
    explicit NullService(const std::string& id) : Service(id, "null-svc") {}
    std::string getServiceId() const override { return "null-svc"; }
    Data process(Data) override { return Null(); }
  };

  auto nullSvc  = std::make_shared<NullService>("null-1");
  auto afterNull = std::make_shared<RecordingService>("after-null", "C");

  auto factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "null-1")    return nullSvc;
    if (id == "after-null") return afterNull;
    return nullptr;
  };
  auto post = [](std::function<void()> fn) { fn(); };
  SubRuntime sr(host, anchor.get(), factory, post);
  sr.populate(json::array({
    {{"serviceId", "null-svc"},  {"instanceId", "null-1"}},
    {{"serviceId", "recording"}, {"instanceId", "after-null"}}
  }));

  sr.process(json{{"x", 1}});

  REQUIRE(afterNull->callCount == 0);
}

// ──────────────────────────────────────────────────────────────────────────────
// Bubbling — one level of nesting via next()
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("result bubbles from SubRuntime to outer host when inner services exhaust via next()",
          "[sub_runtime][bubbling]")
{
  // Outer: [anchorSvc] → [outerReceiver]
  // Inner: [nextCaller]  (owner = anchorSvc)
  //
  // nextCaller.process() calls next() → SubRuntime::processFrom exhausts
  // inner services → bubbles → outerReceiver runs.

  MockRuntimeHost host;
  auto anchorSvc     = std::make_shared<RecordingService>("anchor", "anchor");
  auto outerReceiver = std::make_shared<RecordingService>("outer-recv", "outer");
  host.addService(anchorSvc);
  host.addService(outerReceiver);

  auto nextCaller = std::make_shared<NextCallerService>("nc-1");

  auto sr = makeSubRuntime(host, anchorSvc.get(),
    {{"nc-1", nextCaller}},
    json::array({
      {{"serviceId", "next-caller"}, {"instanceId", "nc-1"}}
    }));

  json input = {{"trace", json::array()}};
  sr->process(input);

  REQUIRE(nextCaller->callCount   == 1);
  REQUIRE(outerReceiver->callCount == 1);
}

TEST_CASE("result does NOT bubble when next() is not called",
          "[sub_runtime][bubbling]")
{
  MockRuntimeHost host;
  auto anchorSvc     = std::make_shared<RecordingService>("anchor", "anchor");
  auto outerReceiver = std::make_shared<RecordingService>("outer-recv", "outer");
  host.addService(anchorSvc);
  host.addService(outerReceiver);

  auto innerSvc = std::make_shared<RecordingService>("inner-1", "I");

  auto sr = makeSubRuntime(host, anchorSvc.get(),
    {{"inner-1", innerSvc}},
    json::array({
      {{"serviceId", "recording"}, {"instanceId", "inner-1"}}
    }));

  sr->process(json{{"x", 1}});

  REQUIRE(innerSvc->callCount     == 1);
  REQUIRE(outerReceiver->callCount == 0); // no bubbling
}

TEST_CASE("inner services after the next()-caller still run before bubbling",
          "[sub_runtime][bubbling]")
{
  // Inner pipeline: [nextCaller] → [innerAfter]
  //
  // nextCaller.next() calls SubRuntime::processFrom(nextCaller, data, true),
  // which runs innerAfter and then bubbles to outerReceiver.  The outer bubble
  // result is returned from next(), which is what nextCaller.process() returns.
  //
  // SubRuntime::process() then assigns data = that result and advances its loop
  // to innerAfter — running it a SECOND time with the already-processed data.
  // This is expected: process() iterates every service in sequence regardless of
  // what next() did internally.

  MockRuntimeHost host;
  auto anchorSvc     = std::make_shared<RecordingService>("anchor", "anchor");
  auto outerReceiver = std::make_shared<RecordingService>("outer-recv", "outer");
  host.addService(anchorSvc);
  host.addService(outerReceiver);

  auto nextCaller  = std::make_shared<NextCallerService>("nc-1");
  auto innerAfter  = std::make_shared<RecordingService>("inner-after", "I");

  auto sr = makeSubRuntime(host, anchorSvc.get(),
    {{"nc-1", nextCaller}, {"inner-after", innerAfter}},
    json::array({
      {{"serviceId", "next-caller"}, {"instanceId", "nc-1"}},
      {{"serviceId", "recording"},   {"instanceId", "inner-after"}}
    }));

  json input = {{"trace", json::array()}};
  sr->process(input);

  REQUIRE(nextCaller->callCount    == 1);
  // innerAfter runs twice: once via processFrom (called by next()), then again
  // in the normal SubRuntime::process() loop after nextCaller returns.
  REQUIRE(innerAfter->callCount    == 2);
  // outerReceiver is reached only once — from the processFrom bubble.
  REQUIRE(outerReceiver->callCount == 1);

  // outerReceiver's input was the data after innerAfter's first run (tag "I")
  auto j = getJSONFromData(outerReceiver->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["trace"][0] == "I");
}

// ──────────────────────────────────────────────────────────────────────────────
// Bubbling — two levels of nesting via next()
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("result bubbles through two SubRuntime levels to the outermost host",
          "[sub_runtime][bubbling]")
{
  // Topology:
  //   MockRuntimeHost: [outerAnchor] → [finalReceiver]
  //   SubRuntime1 (owner=outerAnchor): [innerAnchor]
  //   SubRuntime2 (owner=innerAnchor): [deepNextCaller]
  //
  // deepNextCaller.next():
  //   sr2.processFrom(deepNextCaller, …, true) — exhausted → bubble
  //   sr1.processFrom(innerAnchor,   …, true) — exhausted → bubble
  //   host.processFrom(outerAnchor,  …, true) → finalReceiver runs

  MockRuntimeHost outerHost;
  auto outerAnchor   = std::make_shared<RecordingService>("outer-anchor", "outer-anchor");
  auto finalReceiver = std::make_shared<RecordingService>("final", "final");
  outerHost.addService(outerAnchor);
  outerHost.addService(finalReceiver);

  auto innerAnchor    = std::make_shared<RecordingService>("inner-anchor", "inner-anchor");
  auto deepNextCaller = std::make_shared<NextCallerService>("deep-nc");

  auto post = [](std::function<void()> fn) { fn(); };

  SubRuntime sr1(outerHost, outerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "inner-anchor") return innerAnchor;
      return nullptr;
    }, post);
  sr1.populate(json::array({
    {{"serviceId", "recording"}, {"instanceId", "inner-anchor"}}
  }));

  SubRuntime sr2(sr1, innerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "deep-nc") return deepNextCaller;
      return nullptr;
    }, post);
  sr2.populate(json::array({
    {{"serviceId", "next-caller"}, {"instanceId", "deep-nc"}}
  }));

  json input = {{"trace", json::array()}};
  sr2.process(input);

  REQUIRE(deepNextCaller->callCount == 1);
  REQUIRE(finalReceiver->callCount  == 1);
}

// ──────────────────────────────────────────────────────────────────────────────
// emit() propagation
//
// emit() calls nextAsync() which is synchronous in our mock (post runs
// immediately).  A service should call emit() and return Null() to ensure
// downstream sees exactly one invocation; returning non-Null triggers a second
// invocation through the normal SubRuntime::process() loop.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("emit() from inner service reaches outer host",
          "[sub_runtime][emit]")
{
  // EmitAndStopService calls emit(*j) then returns Null().
  // SubRuntime::process() stops at Null, so outerReceiver runs exactly once
  // (via the emit path).

  MockRuntimeHost host;
  auto anchorSvc     = std::make_shared<RecordingService>("anchor", "anchor");
  auto outerReceiver = std::make_shared<RecordingService>("outer-recv", "outer");
  host.addService(anchorSvc);
  host.addService(outerReceiver);

  auto emitSvc = std::make_shared<EmitAndStopService>("emit-1");

  auto sr = makeSubRuntime(host, anchorSvc.get(),
    {{"emit-1", emitSvc}},
    json::array({
      {{"serviceId", "emit-and-stop"}, {"instanceId", "emit-1"}}
    }));

  json input = {{"x", 1}};
  sr->process(input);

  REQUIRE(emitSvc->callCount      == 1);
  REQUIRE(outerReceiver->callCount == 1);

  auto j = getJSONFromData(outerReceiver->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["emitted"] == true);
}

TEST_CASE("emit() from deeply nested SubRuntime bubbles to outermost host",
          "[sub_runtime][emit]")
{
  // sr2 → sr1 → outerHost: emit + Null in deepest level reaches finalReceiver.

  MockRuntimeHost outerHost;
  auto outerAnchor   = std::make_shared<RecordingService>("outer-anchor", "outer-anchor");
  auto finalReceiver = std::make_shared<RecordingService>("final", "final");
  outerHost.addService(outerAnchor);
  outerHost.addService(finalReceiver);

  auto innerAnchor = std::make_shared<RecordingService>("inner-anchor", "inner-anchor");
  auto deepEmitter = std::make_shared<EmitAndStopService>("deep-emit");

  auto post = [](std::function<void()> fn) { fn(); };

  SubRuntime sr1(outerHost, outerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "inner-anchor") return innerAnchor;
      return nullptr;
    }, post);
  sr1.populate(json::array({
    {{"serviceId", "recording"}, {"instanceId", "inner-anchor"}}
  }));

  SubRuntime sr2(sr1, innerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "deep-emit") return deepEmitter;
      return nullptr;
    }, post);
  sr2.populate(json::array({
    {{"serviceId", "emit-and-stop"}, {"instanceId", "deep-emit"}}
  }));

  json input = {{"level", 2}};
  sr2.process(input);

  REQUIRE(deepEmitter->callCount   == 1);
  REQUIRE(finalReceiver->callCount == 1);

  auto j = getJSONFromData(finalReceiver->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["emitted"] == true);
}

TEST_CASE("multiple emit() calls from inner service all reach outer host",
          "[sub_runtime][emit]")
{
  // MultiEmitService emits 3 times then returns Null.
  // outerReceiver should be called exactly 3 times.

  MockRuntimeHost host;
  auto anchorSvc     = std::make_shared<RecordingService>("anchor", "anchor");
  auto outerReceiver = std::make_shared<RecordingService>("outer-recv", "outer");
  host.addService(anchorSvc);
  host.addService(outerReceiver);

  auto multiSvc = std::make_shared<MultiEmitService>("multi-1");

  auto sr = makeSubRuntime(host, anchorSvc.get(),
    {{"multi-1", multiSvc}},
    json::array({
      {{"serviceId", "multi-emit"}, {"instanceId", "multi-1"}}
    }));

  sr->process(json{{"x", 1}});

  REQUIRE(multiSvc->callCount      == 1);
  REQUIRE(outerReceiver->callCount == 3);
}

TEST_CASE("normal process() return inside SubRuntime does not bubble to outer host",
          "[sub_runtime][emit]")
{
  // A service that returns non-Null data normally (without calling next() or
  // emit()) only propagates to subsequent services WITHIN the SubRuntime.
  // The outer host is not reached — only next() / emit() bubble outward.
  //
  // Here: emitReturn calls emit() (outer host receives once) and also returns
  // data normally.  Because emitReturn is the only service in the sub-runtime,
  // the normal return value stays inside SubRuntime::process() and is never
  // forwarded to the outer host.  downstream receives exactly one call
  // (from the emit path), not two.

  MockRuntimeHost host;
  auto anchorSvc  = std::make_shared<RecordingService>("anchor", "anchor");
  auto downstream = std::make_shared<RecordingService>("downstream", "D");
  host.addService(anchorSvc);
  host.addService(downstream);

  struct EmitAndReturnService final : public Service {
    explicit EmitAndReturnService(const std::string& id)
      : Service(id, "emit-and-return") {}
    std::string getServiceId() const override { return "emit-and-return"; }
    Data process(Data) override {
      emit(json{{"path", "emit"}});
      return json{{"path", "return"}}; // stays inside the sub-runtime
    }
  };

  auto emitReturn = std::make_shared<EmitAndReturnService>("ear-1");

  auto sr = makeSubRuntime(host, anchorSvc.get(),
    {{"ear-1", emitReturn}},
    json::array({
      {{"serviceId", "emit-and-return"}, {"instanceId", "ear-1"}}
    }));

  sr->process(json{{"x", 1}});

  // only the emit() path reaches the outer host
  REQUIRE(downstream->callCount == 1);
  auto j = getJSONFromData(downstream->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["path"] == "emit");
}

// ──────────────────────────────────────────────────────────────────────────────
// SubService configure / state API
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("SubService::getState returns empty pipeline initially",
          "[sub_service]")
{
  SubService svc("sub-1");
  auto state = svc.getState();
  REQUIRE(state["pipeline"].is_array());
  REQUIRE(state["pipeline"].empty());
}

TEST_CASE("SubService appends and removes services via configure()",
          "[sub_service]")
{
  MockRuntimeHost host;
  host.factory = [](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    return std::make_shared<RecordingService>(id, id);
  };

  auto subSvc = std::make_shared<SubService>("sub-1");
  host.addService(subSvc);

  subSvc->configure(json{{
    "appendService", {{"serviceId", "recording"}, {"instanceId", "echo-1"}}
  }});

  auto state = subSvc->getState();
  REQUIRE(state["pipeline"].size() == 1);
  REQUIRE(state["pipeline"][0]["serviceId"]  == "recording");
  REQUIRE(state["pipeline"][0]["instanceId"] == "echo-1");

  subSvc->configure(json{{"removeService", "echo-1"}});
  state = subSvc->getState();
  REQUIRE(state["pipeline"].empty());
}

TEST_CASE("SubService full pipeline replacement via configure()",
          "[sub_service]")
{
  MockRuntimeHost host;
  host.factory = [](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    return std::make_shared<RecordingService>(id, id);
  };

  auto subSvc = std::make_shared<SubService>("sub-1");
  host.addService(subSvc);

  subSvc->configure(json{{"pipeline", json::array({
    {{"serviceId", "recording"}, {"instanceId", "svc-a"}},
    {{"serviceId", "recording"}, {"instanceId", "svc-b"}}
  })}});

  auto state = subSvc->getState();
  REQUIRE(state["pipeline"].size() == 2);
  REQUIRE(state["pipeline"][0]["instanceId"] == "svc-a");
  REQUIRE(state["pipeline"][1]["instanceId"] == "svc-b");

  // Replace with a single service
  subSvc->configure(json{{"pipeline", json::array({
    {{"serviceId", "recording"}, {"instanceId", "svc-x"}}
  })}});

  state = subSvc->getState();
  REQUIRE(state["pipeline"].size() == 1);
  REQUIRE(state["pipeline"][0]["instanceId"] == "svc-x");
}

TEST_CASE("SubService::configure configureService delegates to inner sub-service",
          "[sub_service]")
{
  struct ConfigurableService final : public Service {
    explicit ConfigurableService(const std::string& id)
      : Service(id, "configurable") {}

    std::string getServiceId() const override { return "configurable"; }
    Data process(Data d) override { return d; }

    json configure(Data data) override {
      Service::configure(data);
      auto j = getJSONFromData(data);
      if (j && j->contains("value"))
        m_value = (*j)["value"].get<int>();
      return getState();
    }

    json getState() const override {
      return mergeStateWith({{"value", m_value}});
    }

    int m_value = 0;
  };

  auto innerSvc = std::make_shared<ConfigurableService>("cfg-1");

  MockRuntimeHost host;
  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "cfg-1") return innerSvc;
    return nullptr;
  };

  auto subSvc = std::make_shared<SubService>("sub-1");
  host.addService(subSvc);

  subSvc->configure(json{{
    "appendService", {{"serviceId", "configurable"}, {"instanceId", "cfg-1"}}
  }});

  subSvc->configure(json{{
    "configureService", {{"instanceId", "cfg-1"}, {"state", {{"value", 42}}}}
  }});

  REQUIRE(innerSvc->m_value == 42);

  auto state = subSvc->getState();
  REQUIRE(state["pipeline"][0]["state"]["value"] == 42);
}

TEST_CASE("SubService::process drives data through inner pipeline",
          "[sub_service]")
{
  MockRuntimeHost host;

  auto recA = std::make_shared<RecordingService>("svc-a", "A");
  auto recB = std::make_shared<RecordingService>("svc-b", "B");
  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "svc-a") return recA;
    if (id == "svc-b") return recB;
    return nullptr;
  };

  auto subSvc = std::make_shared<SubService>("sub-1");
  host.addService(subSvc);

  subSvc->configure(json{{"pipeline", json::array({
    {{"serviceId", "recording"}, {"instanceId", "svc-a"}},
    {{"serviceId", "recording"}, {"instanceId", "svc-b"}}
  })}});

  json input = {{"trace", json::array()}};
  auto result = subSvc->process(input);

  REQUIRE(recA->callCount == 1);
  REQUIRE(recB->callCount == 1);

  auto j = getJSONFromData(result);
  REQUIRE(j.has_value());
  REQUIRE((*j)["trace"] == json::array({"A", "B"}));
}

TEST_CASE("SubService::process with inner next() bubbles to outer host",
          "[sub_service][bubbling]")
{
  // Outer host: [subSvc] → [outerReceiver]
  // SubSvc inner pipeline: [nextCaller]
  //
  // When subSvc.process(data) is called:
  //   SubRuntime::process() → nextCaller.process() → next()
  //   → SubRuntime::processFrom exhausted → bubble
  //   → outerHost::processFrom(subSvc, data, true) → outerReceiver

  MockRuntimeHost host;
  auto outerReceiver = std::make_shared<RecordingService>("outer-recv", "outer");

  auto nextCaller = std::make_shared<NextCallerService>("nc-1");
  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "nc-1") return nextCaller;
    return nullptr;
  };

  auto subSvc = std::make_shared<SubService>("sub-1");
  host.addService(subSvc);
  host.addService(outerReceiver);

  subSvc->configure(json{{"appendService",
    {{"serviceId", "next-caller"}, {"instanceId", "nc-1"}}
  }});

  json input = {{"x", 1}};
  subSvc->process(input);

  REQUIRE(nextCaller->callCount    == 1);
  REQUIRE(outerReceiver->callCount == 1);
}
