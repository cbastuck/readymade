#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <functional>
#include <list>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "sub_runtime.h"
#include "services/tracks.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Several pipelines over one input.
//
// Two things are worth pinning and the rest follows: every track is given the
// same value and none can see another's answer, and the shape that leaves is
// the board's to decide rather than this service's.
// ──────────────────────────────────────────────────────────────────────────────
namespace {

// Answers with what its state says, and records that it ran.
class FakeService final : public Service {
public:
  explicit FakeService(const std::string& id, json state = json::object())
    : Service(id, "fake"), m_state(std::move(state)) {}

  std::string getServiceId() const override { return "fake"; }

  json configure(Data data) override {
    auto j = getJSONFromData(data);
    if (j) m_state.update(*j);
    return getState();
  }

  json getState() const override { return m_state; }

  Data process(Data data) override {
    order().push_back(getId());
    if (m_state.value("stop", false)) return Null();
    if (m_state.contains("answer")) return m_state["answer"];
    auto j = getJSONFromData(data);
    return j ? json{{"saw", *j}} : data;
  }

  // What ran, in the order it ran, shared by every instance in a test.
  static std::vector<std::string>& order() {
    static std::vector<std::string> ran;
    return ran;
  }

private:
  json m_state;
};

// Picks one field out of the reducer's envelope, so a test can say what the
// reducer was given without a Map service to hand.
class PickService final : public Service {
public:
  explicit PickService(const std::string& id, std::string field)
    : Service(id, "pick"), m_field(std::move(field)) {}

  std::string getServiceId() const override { return "pick"; }

  Data process(Data data) override {
    auto j = getJSONFromData(data);
    if (!j || !j->contains(m_field)) return Null();
    return (*j)[m_field];
  }

private:
  std::string m_field;
};

class MockRuntimeHost final : public RuntimeHost {
public:
  std::list<std::shared_ptr<Service>> services;
  std::map<std::string, std::shared_ptr<Service>> instances;

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
  void notifyProcessFinished(const Service&, const Data&) override {}
  void log(const Service&, LogLevel, const std::string&,
           const nlohmann::json& = nullptr) override {}
  void forwardLog(const LogEntry&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }

  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override {
    auto factory = [this](const std::string&, const std::string& id)
      -> std::shared_ptr<Service> {
      auto it = instances.find(id);
      return it != instances.end() ? it->second : nullptr;
    };
    auto post = [](std::function<void()> fn) { fn(); };
    auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, factory, post);
    sr->populate(servicesConfig);
    return sr;
  }

  SecretVault m_vault;
  SlotStore m_slots;
};

/** A track of one fake service, named after the track. */
json trackOf(const std::string& name) {
  return json{
    {"name", name},
    {"pipeline", json::array({
      json{{"serviceId", "fake"}, {"instanceId", name}}
    })}
  };
}

} // namespace

TEST_CASE("Tracks gives every track the same input and answers in order",
          "[tracks]")
{
  MockRuntimeHost host;
  auto tracks = std::make_shared<Tracks>("tracks-1");
  host.addService(tracks);

  host.instances["keep"] = std::make_shared<FakeService>("keep");
  host.instances["drop"] = std::make_shared<FakeService>("drop");
  FakeService::order().clear();

  tracks->configure(json{{"tracks", json::array({trackOf("keep"), trackOf("drop")})}});

  auto result = tracks->process(json{{"intent", "keep"}});
  auto j = getJSONFromData(result);
  REQUIRE(j.has_value());
  REQUIRE(j->is_array());
  REQUIRE(j->size() == 2);
  // Neither track was handed the other's answer: both saw the input.
  REQUIRE((*j)[0]["saw"]["intent"] == "keep");
  REQUIRE((*j)[1]["saw"]["intent"] == "keep");
  REQUIRE(FakeService::order() == std::vector<std::string>{"keep", "drop"});
}

TEST_CASE("Tracks leaves a hole where a track stopped", "[tracks]")
{
  // Position still names the track that produced it, so a missing answer is
  // visible rather than absent.
  MockRuntimeHost host;
  auto tracks = std::make_shared<Tracks>("tracks-1");
  host.addService(tracks);

  host.instances["keep"] = std::make_shared<FakeService>("keep", json{{"stop", true}});
  host.instances["drop"] = std::make_shared<FakeService>("drop", json{{"answer", json{{"rows", 1}}}});

  tracks->configure(json{{"tracks", json::array({trackOf("keep"), trackOf("drop")})}});

  auto j = getJSONFromData(tracks->process(json::object()));
  REQUIRE(j.has_value());
  REQUIRE((*j)[0].is_null());
  REQUIRE((*j)[1]["rows"] == 1);
}

TEST_CASE("Tracks hands the reducer what came in beside what was answered",
          "[tracks]")
{
  MockRuntimeHost host;
  auto tracks = std::make_shared<Tracks>("tracks-1");
  host.addService(tracks);

  host.instances["keep"] = std::make_shared<FakeService>("keep", json{{"answer", "wrote"}});
  host.instances["carry"] = std::make_shared<PickService>("carry", "input");

  tracks->configure(json{
    {"tracks", json::array({trackOf("keep")})},
    {"reduce", json::array({
      json{{"serviceId", "pick"}, {"instanceId", "carry"}}
    })}
  });

  // Carrying the input on is the commonest reduce there is: the tracks were
  // side effects, and what leaves is what came in.
  auto j = getJSONFromData(tracks->process(json{{"link", "https://example.test"}}));
  REQUIRE(j.has_value());
  REQUIRE((*j)["link"] == "https://example.test");
}

TEST_CASE("Tracks stops only when the reducer says so", "[tracks]")
{
  MockRuntimeHost host;
  auto tracks = std::make_shared<Tracks>("tracks-1");
  host.addService(tracks);

  host.instances["a"] = std::make_shared<FakeService>("a", json{{"stop", true}});
  host.instances["b"] = std::make_shared<FakeService>("b", json{{"stop", true}});

  tracks->configure(json{{"tracks", json::array({trackOf("a"), trackOf("b")})}});

  // An array of nothing but nulls is still an array; whether that means stop
  // is the board's to say.
  auto silent = tracks->process(json::object());
  REQUIRE_FALSE(isNull(silent));
  auto j = getJSONFromData(silent);
  REQUIRE(j.has_value());
  REQUIRE(j->size() == 2);

  // A reducer that finds nothing to say stops the pipeline, as any service does.
  host.instances["missing"] = std::make_shared<PickService>("missing", "nothing-here");
  tracks->configure(json{{"reduce", json::array({
    json{{"serviceId", "pick"}, {"instanceId", "missing"}}
  })}});
  REQUIRE(isNull(tracks->process(json::object())));
}

TEST_CASE("Tracks reports its arrangement, and refuses a name it cannot keep",
          "[tracks]")
{
  MockRuntimeHost host;
  auto tracks = std::make_shared<Tracks>("tracks-1");
  host.addService(tracks);
  host.instances["keep"] = std::make_shared<FakeService>("keep");

  tracks->configure(json{{"tracks", json::array({trackOf("keep")})}});

  auto state = tracks->getState();
  REQUIRE(state["run"] == "serial");
  REQUIRE(state["tracks"].size() == 1);
  REQUIRE(state["tracks"][0]["name"] == "keep");
  REQUIRE(state["tracks"][0]["pipeline"][0]["instanceId"] == "keep");

  // The reducer's name is reserved, and a repeated name would make a track
  // impossible to address.
  tracks->configure(json{{"tracks", json::array({trackOf("reduce")})}});
  REQUIRE(tracks->getState()["error"].get<std::string>().find("reducer") != std::string::npos);
  REQUIRE(tracks->getState()["tracks"].size() == 1);
}
