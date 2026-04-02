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

// Immediately delegates processing downstream via next().
class NextCallerService final : public Service {
public:
  explicit NextCallerService(const std::string& id)
    : Service(id, "next-caller") {}

  std::string getServiceId() const override { return "next-caller"; }

  Data process(Data data) override {
    ++callCount;
    return next(data); // hand off to whatever comes next
  }

  int callCount = 0;
};

// Minimal RuntimeHost with a flat, ordered list of services.
class MockRuntimeHost final : public RuntimeHost {
public:
  using SvcList = std::list<std::shared_ptr<Service>>;
  SvcList services;

  // Provide this before calling createSubRuntime (used by SubService).
  std::function<std::shared_ptr<Service>(const std::string& serviceId,
                                         const std::string& instanceId)> factory;

  void addService(std::shared_ptr<Service> svc) {
    svc->setParentHost(*this);
    services.push_back(std::move(svc));
  }

  // ── RuntimeHost ────────────────────────────────────────────────────────────

  Data processFrom(const Service& svc, Data data,
                   bool advanceBefore,
                   std::function<void(Data)> callback) override {
    auto it = std::find_if(services.begin(), services.end(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
    REQUIRE(it != services.end()); // fail fast if wiring is wrong

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
    // synchronous in tests
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
    REQUIRE(factory); // callers must wire up a factory first
    auto post = [](std::function<void()> fn) { fn(); };
    auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, factory, post);
    sr->populate(servicesConfig);
    return sr;
  }
};

// Convenience: build a SubRuntime backed by a pre-populated instance map.
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

TEST_CASE("SubRuntime::process stops at the first null output",
          "[sub_runtime]")
{
  MockRuntimeHost host;
  auto anchor = std::make_shared<RecordingService>("anchor", "anchor");
  host.addService(anchor);

  // nullifier: returns Null() regardless of input
  struct NullService final : public Service {
    explicit NullService(const std::string& id) : Service(id, "null-svc") {}
    std::string getServiceId() const override { return "null-svc"; }
    Data process(Data) override { return Null(); }
  };

  auto nullSvc = std::make_shared<NullService>("null-1");
  auto afterNull = std::make_shared<RecordingService>("after-null", "C");

  auto factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "null-1")   return nullSvc;
    if (id == "after-null") return afterNull;
    return nullptr;
  };
  auto post = [](std::function<void()> fn) { fn(); };
  SubRuntime sr(host, anchor.get(), factory, post);
  sr.populate(json::array({
    {{"serviceId", "null-svc"},   {"instanceId", "null-1"}},
    {{"serviceId", "recording"}, {"instanceId", "after-null"}}
  }));

  sr.process(json{{"x", 1}});

  REQUIRE(afterNull->callCount == 0); // pipeline stopped at null
}

// ──────────────────────────────────────────────────────────────────────────────
// Bubbling — one level of nesting
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("result bubbles from SubRuntime to outer host when inner services exhaust via next()",
          "[sub_runtime][bubbling]")
{
  // Outer pipeline:  [anchorSvc] → [outerReceiver]
  // Inner pipeline:  [nextCaller]   (owned by anchorSvc)
  //
  // When nextCaller.process() calls next(), SubRuntime has no further
  // services → shouldBubbleToParent=true → outerReceiver runs.

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

TEST_CASE("result does NOT bubble when next() is not called (normal return)",
          "[sub_runtime][bubbling]")
{
  // If the inner service just returns data normally, processFrom is never
  // called inside the sub-runtime, so the outer receiver must stay at zero.

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

  REQUIRE(innerSvc->callCount    == 1);
  REQUIRE(outerReceiver->callCount == 0); // no bubbling expected
}

TEST_CASE("inner services after the next()-caller still run before bubbling",
          "[sub_runtime][bubbling]")
{
  // Pipeline:  nextCaller → innerAfter  (both inside sub-runtime)
  // nextCaller.next() calls processFrom(nextCaller, data, true),
  // which advances past nextCaller to innerAfter first, then bubbles.

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

  REQUIRE(nextCaller->callCount   == 1);
  REQUIRE(innerAfter->callCount   == 1);
  REQUIRE(outerReceiver->callCount == 1);

  // innerAfter runs before outerReceiver
  auto j = getJSONFromData(outerReceiver->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["trace"].size() == 1); // "I" was added by innerAfter
  REQUIRE((*j)["trace"][0] == "I");
}

// ──────────────────────────────────────────────────────────────────────────────
// Bubbling — two levels of nesting
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("result bubbles through two SubRuntime levels to the outermost host",
          "[sub_runtime][bubbling]")
{
  // Topology:
  //   MockRuntimeHost: [outerAnchor] → [finalReceiver]
  //   SubRuntime1 (owner=outerAnchor): [innerAnchor]
  //   SubRuntime2 (owner=innerAnchor): [deepNextCaller]
  //
  // deepNextCaller.next()
  //   → sr2.processFrom(deepNextCaller, data, true)   — no more in sr2
  //   → sr1.processFrom(innerAnchor,   data, true)    — no more in sr1
  //   → host.processFrom(outerAnchor,  data, true)    — finalReceiver runs

  MockRuntimeHost outerHost;
  auto outerAnchor   = std::make_shared<RecordingService>("outer-anchor", "outer-anchor");
  auto finalReceiver = std::make_shared<RecordingService>("final", "final");
  outerHost.addService(outerAnchor);
  outerHost.addService(finalReceiver);

  auto innerAnchor    = std::make_shared<RecordingService>("inner-anchor", "inner-anchor");
  auto deepNextCaller = std::make_shared<NextCallerService>("deep-nc");

  auto post = [](std::function<void()> fn) { fn(); };

  // SubRuntime1: parent=outerHost, owner=outerAnchor
  SubRuntime sr1(outerHost, outerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "inner-anchor") return innerAnchor;
      return nullptr;
    }, post);
  sr1.populate(json::array({
    {{"serviceId", "recording"}, {"instanceId", "inner-anchor"}}
  }));

  // SubRuntime2: parent=sr1, owner=innerAnchor
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

  auto echoSvc = std::make_shared<RecordingService>("echo-1", "E");
  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "echo-1") return echoSvc;
    return std::make_shared<RecordingService>(id, id);
  };

  auto subSvc = std::make_shared<SubService>("sub-1");
  host.addService(subSvc);

  // Append with explicit instanceId
  subSvc->configure(json{{
    "appendService", {{"serviceId", "recording"}, {"instanceId", "echo-1"}}
  }});

  auto state = subSvc->getState();
  REQUIRE(state["pipeline"].size() == 1);
  REQUIRE(state["pipeline"][0]["serviceId"] == "recording");
  REQUIRE(state["pipeline"][0]["instanceId"] == "echo-1");

  // Remove
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

  // Replace with a single-service pipeline
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
  MockRuntimeHost host;

  // The inner service exposes configurable state via configure()
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

  // Configure the inner service through the SubService
  subSvc->configure(json{{
    "configureService", {{"instanceId", "cfg-1"}, {"state", {{"value", 42}}}}
  }});

  // Verify the inner service received the config
  REQUIRE(innerSvc->m_value == 42);

  // Verify state is reflected in SubService getState()
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

// ──────────────────────────────────────────────────────────────────────────────
// emit() propagation through nested SubServices
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("emit() from inner SubService service reaches outer host via bubbling",
          "[sub_service][emit]")
{
  // Setup: outer pipeline [anchor] → [emitCapture]
  //        SubService inside anchor with an emit-calling service
  
  // Service that calls emit() on completion
  struct EmittingService final : public Service {
    explicit EmittingService(const std::string& id)
      : Service(id, "emitting") {}

    std::string getServiceId() const override { return "emitting"; }

    Data process(Data data) override {
      auto j = getJSONFromData(data);
      if (j) {
        (*j)["emitted"] = true;
        emit(*j);
      }
      return data;
    }
  };

  MockRuntimeHost host;
  auto anchor = std::make_shared<RecordingService>("anchor", "anchor");
  auto emitCapture = std::make_shared<RecordingService>("emit-capture", "captured");
  host.addService(anchor);
  host.addService(emitCapture);

  auto emittingSvc = std::make_shared<EmittingService>("emit-1");
  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "emit-1") return emittingSvc;
    return nullptr;
  };

  auto sr = makeSubRuntime(host, anchor.get(),
    {{"emit-1", emittingSvc}},
    json::array({
      {{"serviceId", "emitting"}, {"instanceId", "emit-1"}}
    }));

  json input = {{"x", 1}};
  sr->process(input);

  // The emit() call should have reached emitCapture
  REQUIRE(emitCapture->callCount >= 1);
  auto j = getJSONFromData(emitCapture->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["emitted"] == true);
}

TEST_CASE("emit() from doubly-nested SubService bubbles to outermost host",
          "[sub_service][emit][deep-nesting]")
{
  // Topology:
  //   MockRuntimeHost: [outerAnchor] → [finalCapture]
  //   SubRuntime1 (owner=outerAnchor): [innerAnchor]
  //   SubRuntime2 (owner=innerAnchor): [deepEmitter]
  //
  // deepEmitter.emit() should bubble:
  //   SR2.processFrom(deepEmitter, data, true) → SR1.processFrom(...) 
  //   → host.processFrom(...) → finalCapture runs

  struct EmittingService final : public Service {
    explicit EmittingService(const std::string& id)
      : Service(id, "emitting") {}
    std::string getServiceId() const override { return "emitting"; }
    Data process(Data data) override {
      auto j = getJSONFromData(data);
      if (j) {
        (*j)["deep-emit"] = true;
        emit(*j);
      }
      return data;
    }
  };

  MockRuntimeHost outerHost;
  auto outerAnchor = std::make_shared<RecordingService>("outer-anchor", "outer-anchor");
  auto finalCapture = std::make_shared<RecordingService>("final-capture", "final");
  outerHost.addService(outerAnchor);
  outerHost.addService(finalCapture);

  auto innerAnchor = std::make_shared<RecordingService>("inner-anchor", "inner-anchor");
  auto deepEmitter = std::make_shared<EmittingService>("deep-emit");

  auto post = [](std::function<void()> fn) { fn(); };

  // SubRuntime1: parent=outerHost, owner=outerAnchor
  SubRuntime sr1(outerHost, outerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "inner-anchor") return innerAnchor;
      return nullptr;
    }, post);
  sr1.populate(json::array({
    {{"serviceId", "recording"}, {"instanceId", "inner-anchor"}}
  }));

  // SubRuntime2: parent=sr1, owner=innerAnchor
  SubRuntime sr2(sr1, innerAnchor.get(),
    [&](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      if (id == "deep-emit") return deepEmitter;
      return nullptr;
    }, post);
  sr2.populate(json::array({
    {{"serviceId", "emitting"}, {"instanceId", "deep-emit"}}
  }));

  json input = {{"level", 2}};
  sr2.process(input);

  // finalCapture should have received the emitted data
  REQUIRE(finalCapture->callCount >= 1);
  auto j = getJSONFromData(finalCapture->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["deep-emit"] == true);
}

TEST_CASE("multiple emit() calls from nested SubService all reach outer host",
          "[sub_service][emit][multiple]")
{
  // Service that calls emit() multiple times
  struct MultiEmitterService final : public Service {
    explicit MultiEmitterService(const std::string& id)
      : Service(id, "multi-emit") {}
    std::string getServiceId() const override { return "multi-emit"; }

    Data process(Data data) override {
      auto j = getJSONFromData(data);
      if (!j) return data;
      
      for (int i = 0; i < 3; ++i) {
        auto copy = *j;
        copy["emission"] = i;
        emit(copy);
      }
      return data;
    }
  };

  MockRuntimeHost host;
  auto anchor = std::make_shared<RecordingService>("anchor", "anchor");
  auto captureMulti = std::make_shared<RecordingService>("capture", "captured");
  host.addService(anchor);
  host.addService(captureMulti);

  auto multiEmitter = std::make_shared<MultiEmitterService>("multi-1");
  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "multi-1") return multiEmitter;
    return nullptr;
  };

  auto sr = makeSubRuntime(host, anchor.get(),
    {{"multi-1", multiEmitter}},
    json::array({
      {{"serviceId", "multi-emit"}, {"instanceId", "multi-1"}}
    }));

  json input = {{"x", 1}};
  sr->process(input);

  // captureMulti should have been called at least 3 times (once for each emit)
  REQUIRE(captureMulti->callCount >= 3);
}

TEST_CASE("emit() from SubService inner service does not bypass siblings",
          "[sub_service][emit][order]")
{
  // SubService pipeline: [emitter] → [sibling]
  // emitter.emit() should NOT cause sibling to be skipped; both should run

  struct EmitterThenNext final : public Service {
    explicit EmitterThenNext(const std::string& id)
      : Service(id, "emit-then-next") {}
    std::string getServiceId() const override { return "emit-then-next"; }

    Data process(Data data) override {
      auto j = getJSONFromData(data);
      if (j) {
        (*j)["emitted"] = true;
        emit(*j);  // emit the data out
        (*j)["returned"] = true;  // also return modified data
      }
      return data;
    }
  };

  MockRuntimeHost host;
  auto anchor = std::make_shared<RecordingService>("anchor", "anchor");
  host.addService(anchor);

  auto emitter = std::make_shared<EmitterThenNext>("emit-1");
  auto sibling = std::make_shared<RecordingService>("sibling", "S");

  host.factory = [&](const std::string&, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (id == "emit-1") return emitter;
    if (id == "sibling") return sibling;
    return nullptr;
  };

  auto sr = makeSubRuntime(host, anchor.get(),
    {{"emit-1", emitter}, {"sibling", sibling}},
    json::array({
      {{"serviceId", "emit-then-next"}, {"instanceId", "emit-1"}},
      {{"serviceId", "recording"}, {"instanceId", "sibling"}}
    }));

  json input = {{"x", 1}};
  auto result = sr->process(input);

  // Both emitter and sibling should have been called
  REQUIRE(emitter->callCount > 0);
  REQUIRE(sibling->callCount == 1);

  // sibling should see "returned" flag added by emitter
  auto j = getJSONFromData(sibling->lastInput);
  REQUIRE(j.has_value());
  REQUIRE((*j)["returned"] == true);
}
