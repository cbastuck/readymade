#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <functional>
#include <list>
#include <memory>
#include <string>
#include <vector>

#include <service.h>
#include <types/data.h>
#include "address.h"
#include "runtime_host.h"
#include "sub_runtime.h"
#include "services/hold.h"
#include "services/sub_service.h"

using namespace hkp;

/**
 * Scopes: addressing into one, ending one, and what one keeps to itself.
 *
 * A scope is a `sub-service` that can decline to pass its result on and can
 * hold state its children share — the two flows on one runtime that a Stopper
 * between them used to mark by convention, said by the flow that ends rather
 * than by the gap after it.
 *
 * Mirrors hkp-node/tests/scoped-address.test.ts, stop-propagation.test.ts and
 * scope-slots.test.ts, and hkp-python/tests/test_scopes.py.
 */

namespace {

/** Reports on every call and passes its input on, so it can be watched. */
class WitnessService final : public Service {
public:
  explicit WitnessService(const std::string& id) : Service(id, "witness") {}
  std::string getServiceId() const override { return "witness"; }
  Data process(Data data) override {
    ++callCount;
    sendNotification(json{{"seen", callCount}});
    return data;
  }
  int callCount = 0;
};

/** Replaces whatever it is given with a mark the far side can recognise. */
class MarkService final : public Service {
public:
  explicit MarkService(const std::string& id) : Service(id, "mark") {}
  std::string getServiceId() const override { return "mark"; }
  Data process(Data) override { return json{{"mark", true}}; }
};

/**
 * Hands its input onward itself rather than answering with it.
 *
 * The second route out of a sub-pipeline: what a service produces without
 * being asked — a Timer tick, a deferred result that came back later — bubbles
 * through the owner and drives the services after it. A scope that returns
 * nothing from process() does not close that on its own.
 */
class BubblingService final : public Service {
public:
  explicit BubblingService(const std::string& id) : Service(id, "bubbling") {}
  std::string getServiceId() const override { return "bubbling"; }
  Data process(Data data) override { return next(data); }
};

/** Records what reached it, so "nothing got past" is a claim about a run. */
class SinkService final : public Service {
public:
  explicit SinkService(const std::string& id) : Service(id, "sink") {}
  std::string getServiceId() const override { return "sink"; }
  Data process(Data data) override {
    ++callCount;
    lastInput = data;
    return data;
  }
  int callCount = 0;
  Data lastInput = Undefined();
};

class MockHost final : public RuntimeHost {
public:
  std::list<std::shared_ptr<Service>> services;
  std::function<std::shared_ptr<Service>(const std::string&, const std::string&)> factory;

  void addService(std::shared_ptr<Service> svc) {
    svc->setParentHost(*this);
    services.push_back(std::move(svc));
  }

  Data processFrom(const Service& svc, Data data, bool advanceBefore,
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

  struct Sent { Data data; MessagePurpose purpose; std::string sender; };
  std::vector<Sent> sent;

  void sendData(Data data, MessagePurpose purpose, const std::string& sender,
                std::function<void(Data)>) override {
    sent.push_back({ std::move(data), purpose, sender });
  }

  void notifyProcessFinished(const Service&, const Data&) override {}
  void log(const Service&, LogLevel, const std::string&,
           const nlohmann::json& = nullptr) override {}
  void forwardLog(const LogEntry&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }

  size_t notificationsFrom(const std::string& sender) const {
    return static_cast<size_t>(std::count_if(
      sent.cbegin(), sent.cend(), [&](const Sent& s) {
        return s.sender == sender && s.purpose == MessagePurpose::NOTIFICATION;
      }));
  }

  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override {
    REQUIRE(factory);
    auto post = [](std::function<void()> fn) { fn(); };
    auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, factory, post);
    sr->populate(servicesConfig);
    return sr;
  }

  SecretVault m_vault;
  SlotStore m_slots;
};

/** A factory covering every service these tests nest. */
std::function<std::shared_ptr<Service>(const std::string&, const std::string&)>
makeFactory() {
  return [](const std::string& serviceId, const std::string& id)
    -> std::shared_ptr<Service>
  {
    if (serviceId == "witness") return std::make_shared<WitnessService>(id);
    if (serviceId == "mark")    return std::make_shared<MarkService>(id);
    if (serviceId == "sink")    return std::make_shared<SinkService>(id);
    if (serviceId == "bubbling") return std::make_shared<BubblingService>(id);
    if (serviceId == "sub-service") return std::make_shared<SubService>(id);
    if (serviceId == "hold")    return std::make_shared<Hold>(id);
    return nullptr;
  };
}

json entry(const std::string& serviceId, const std::string& id,
           json state = json::object()) {
  return json{{"serviceId", serviceId}, {"instanceId", id}, {"state", state}};
}

} // namespace

TEST_CASE("An address reaches a service inside a scope",
          "[services][sub-service][address]") {
  MockHost host;
  host.factory = makeFactory();

  auto outer = std::make_shared<SubService>("outer");
  host.addService(outer);
  outer->configure(json{{"pipeline", json::array({
    entry("witness", "witness-1"),
    entry("sub-service", "inner", json{{"pipeline", json::array({
      entry("mark", "mark-1")
    })}})
  })}});

  // One level down, and two: what makes an address a path rather than a single
  // hop into a container.
  REQUIRE(outer->findNested("witness-1") != nullptr);
  REQUIRE(outer->findNested("witness-1")->getId() == "witness-1");

  auto inner = outer->findNested("inner");
  REQUIRE(inner != nullptr);
  REQUIRE(inner->findNested("mark-1") != nullptr);

  // A partial address is a miss, not a match.
  REQUIRE(outer->findNested("nope") == nullptr);
}

TEST_CASE("A scope can be entered at one of its services",
          "[services][sub-service][address]") {
  MockHost host;
  host.factory = makeFactory();

  auto scope = std::make_shared<SubService>("scope");
  host.addService(scope);
  scope->configure(json{{"pipeline", json::array({
    entry("witness", "skipped"),
    entry("mark", "mark-1")
  })}});

  Data result;
  REQUIRE(scope->processNested("mark-1", json{{"go", 1}}, result));

  auto j = getJSONFromData(result);
  REQUIRE(j);
  REQUIRE((*j)["mark"] == true);
  // What precedes the named service does not run, which is the whole of what
  // "enter here" means.
  auto skipped = std::dynamic_pointer_cast<WitnessService>(scope->findNested("skipped"));
  REQUIRE(skipped);
  REQUIRE(skipped->callCount == 0);
}

TEST_CASE("A nested service reports under its address at every depth",
          "[services][sub-service][address][notifications]") {
  MockHost host;
  host.factory = makeFactory();

  auto outer = std::make_shared<SubService>("outer");
  host.addService(outer);
  outer->configure(json{{"pipeline", json::array({
    entry("sub-service", "inner", json{{"pipeline", json::array({
      entry("witness", "witness-1")
    })}})
  })}});

  // Measured as a delta, because a nested service also reports while it is
  // being configured by populate() — and that report is prefixed too, which is
  // the point: there is no moment at which a nested service speaks under a
  // name the board cannot dial.
  const auto before = host.notificationsFrom("outer.inner.witness-1");
  outer->process(json{{"go", 1}});

  REQUIRE(host.notificationsFrom("outer.inner.witness-1") == before + 1);
  // Never under the bare instanceId, at any point in its life.
  REQUIRE(host.notificationsFrom("witness-1") == 0);
  REQUIRE(host.notificationsFrom("inner.witness-1") == 0);
}

TEST_CASE("A scope that stops propagation answers nothing",
          "[services][sub-service][stop-propagation]") {
  MockHost host;
  host.factory = makeFactory();

  auto scope = std::make_shared<SubService>("scope");
  host.addService(scope);
  auto after = std::make_shared<SinkService>("after");
  host.addService(after);

  scope->configure(json{
    {"stopPropagation", true},
    {"pipeline", json::array({ entry("mark", "mark-1") })}
  });

  auto result = scope->process(json{{"go", 1}});
  REQUIRE(isNull(result));
  REQUIRE(after->callCount == 0);
}

TEST_CASE("A scope says nothing about propagation by default",
          "[services][sub-service][stop-propagation]") {
  MockHost host;
  host.factory = makeFactory();

  auto scope = std::make_shared<SubService>("scope");
  host.addService(scope);
  scope->configure(json{{"pipeline", json::array({ entry("mark", "mark-1") })}});

  // The default is the pipeline a board already has.
  auto result = scope->process(json{{"go", 1}});
  auto j = getJSONFromData(result);
  REQUIRE(j);
  REQUIRE((*j)["mark"] == true);

  const auto state = scope->getState();
  REQUIRE(state["stopPropagation"] == false);
  REQUIRE(state["scope"]["slots"] == "own");
}

TEST_CASE("A scope holds in its own cells unless told otherwise",
          "[services][sub-service][slots]") {
  MockHost host;
  host.factory = makeFactory();

  auto writes = std::make_shared<SubService>("writes");
  host.addService(writes);
  writes->configure(json{{"pipeline", json::array({
    entry("hold", "writer", json{{"slot", "shared"}, {"op", "write"}})
  })}});

  auto reader = std::make_shared<Hold>("reader");
  reader->configure(json{{"slot", "shared"}, {"op", "read"}});
  host.addService(reader);

  writes->process(json{{"value", 7}});

  // The name is the same on both sides and still reaches a different cell.
  REQUIRE(isNull(reader->process(Undefined())));
}

TEST_CASE("A scope reaches the runtime's cells when it says it inherits",
          "[services][sub-service][slots]") {
  MockHost host;
  host.factory = makeFactory();

  auto writes = std::make_shared<SubService>("writes");
  host.addService(writes);
  writes->configure(json{
    {"scope", json{{"slots", "inherit"}}},
    {"pipeline", json::array({
      entry("hold", "writer", json{{"slot", "shared"}, {"op", "write"}})
    })}
  });

  auto reader = std::make_shared<Hold>("reader");
  reader->configure(json{{"slot", "shared"}, {"op", "read"}});
  host.addService(reader);

  writes->process(json{{"value", 7}});

  auto held = getJSONFromData(reader->process(Undefined()));
  REQUIRE(held);
  REQUIRE((*held)["value"] == 7);
}

TEST_CASE("Two copies of one scope keep their cells apart",
          "[services][sub-service][slots]") {
  MockHost host;
  host.factory = makeFactory();

  auto left = std::make_shared<SubService>("left");
  auto right = std::make_shared<SubService>("right");
  host.addService(left);
  host.addService(right);

  const json pipeline = json{{"pipeline", json::array({
    entry("hold", "cell", json{{"slot", "shared"}, {"op", "write"}})
  })}};
  left->configure(pipeline);
  right->configure(json{{"pipeline", json::array({
    entry("hold", "cell", json{{"slot", "shared"}, {"op", "read"}})
  })}});

  left->process(json{{"value", 7}});

  // Same scope shape, same slot name, same instanceId inside: still separate.
  auto cell = right->findNested("cell");
  REQUIRE(cell);
  REQUIRE(isNull(cell->process(Undefined())));
}

TEST_CASE("splitAddress and joinAddress agree", "[address]") {
  REQUIRE(splitAddress("read.kept-articles") ==
          std::vector<std::string>{"read", "kept-articles"});
  REQUIRE(splitAddress("flat") == std::vector<std::string>{"flat"});
  // Empty segments are dropped rather than becoming a name nothing carries.
  REQUIRE(splitAddress("a..b") == std::vector<std::string>{"a", "b"});
  REQUIRE(joinAddress("read", "feeds") == "read.feeds");
  REQUIRE(joinAddress("", "feeds") == "feeds");
  REQUIRE(isScopedAddress("read.feeds"));
  REQUIRE_FALSE(isScopedAddress("feeds"));
}


TEST_CASE("A scope that stops propagation drops what its pipeline pushes",
          "[services][sub-service][stop-propagation]") {
  // The route that returning Null from process() does not cover, and the one
  // the RSS reader board turns on: a fetch inside the scope answers later and
  // pushes, which without this would drive the statements after the scope on
  // every refresh.
  MockHost host;
  host.factory = makeFactory();

  auto scope = std::make_shared<SubService>("scope");
  host.addService(scope);
  auto after = std::make_shared<SinkService>("after");
  host.addService(after);

  scope->configure(json{
    {"stopPropagation", true},
    {"pipeline", json::array({ entry("bubbling", "pusher") })}
  });

  scope->process(json{{"go", 1}});
  REQUIRE(after->callCount == 0);
}

TEST_CASE("The same push leaves a scope that does not stop",
          "[services][sub-service][stop-propagation]") {
  // The other half of the one above: without the flag the push reaches the
  // service after the scope, so that test measures the flag and not a
  // pipeline that never pushed.
  MockHost host;
  host.factory = makeFactory();

  auto scope = std::make_shared<SubService>("scope");
  host.addService(scope);
  auto after = std::make_shared<SinkService>("after");
  host.addService(after);

  scope->configure(json{
    {"pipeline", json::array({ entry("bubbling", "pusher") })}
  });

  scope->process(json{{"go", 1}});
  REQUIRE(after->callCount == 1);
}
