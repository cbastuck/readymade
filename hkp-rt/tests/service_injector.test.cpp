#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <string>
#include <vector>

#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "services/injector.h"

using namespace hkp;

namespace {

// Records everything a service pushes downstream and everything it notifies.
class CapturingHost final : public RuntimeHost {
public:
  std::vector<Data> pushed;
  std::vector<Data> notifications;

  void attach(Service& svc) { svc.setParentHost(*this); }

  Data processFrom(const Service&, Data data, bool,
                   std::function<void(Data)> callback) override {
    pushed.push_back(data);
    if (callback) {
      callback(data);
    }
    return data;
  }

  void scheduleProcessFrom(const Service& svc, Data data, bool advanceBefore) override {
    processFrom(svc, data, advanceBefore, nullptr);
  }

  bool isConnected(const Service&) const override { return true; }

  void sendData(Data data, MessagePurpose, const std::string&,
                std::function<void(Data)>) override {
    notifications.push_back(data);
  }

  std::shared_ptr<SubRuntime> createSubRuntime(const Service&, const json&) override {
    return nullptr;
  }
};

} // namespace

TEST_CASE("Injector passes input through when nothing was injected",
          "[services][injector]") {
  Injector svc("injector-1");

  auto out = svc.process(json{{"upstream", true}});

  auto j = getJSONFromData(out);
  REQUIRE(j.has_value());
  REQUIRE((*j)["upstream"] == true);
}

TEST_CASE("Injector replaces the input with the stored injection",
          "[services][injector]") {
  Injector svc("injector-1");
  svc.configure(json{{"recentInjection", json{{"x", 1}}}});

  auto out = svc.process(json{{"upstream", true}});

  auto j = getJSONFromData(out);
  REQUIRE(j.has_value());
  REQUIRE((*j)["x"] == 1);
  REQUIRE(!j->contains("upstream"));
}

TEST_CASE("Injector pushes the injected value downstream",
          "[services][injector]") {
  CapturingHost host;
  Injector svc("injector-1");
  host.attach(svc);

  svc.configure(json{{"inject", json{{"action", "reset"}}}});

  REQUIRE(host.pushed.size() == 1);
  auto j = getJSONFromData(host.pushed[0]);
  REQUIRE(j.has_value());
  REQUIRE((*j)["action"] == "reset");
}

TEST_CASE("Injector injects a JSON string as text", "[services][injector]") {
  CapturingHost host;
  Injector svc("injector-1");
  host.attach(svc);

  svc.configure(json{{"inject", "hello"}});

  REQUIRE(host.pushed.size() == 1);
  auto text = getStringFromData(host.pushed[0]);
  REQUIRE(text.has_value());
  REQUIRE(*text == "hello");
  REQUIRE(svc.getState()["recentInjection"] == "hello");
}

TEST_CASE("Injector decodes a base64 payload into binary data",
          "[services][injector]") {
  CapturingHost host;
  Injector svc("injector-1");
  host.attach(svc);

  svc.configure(json{{"injectBinary", "SGVsbG8h"}}); // "Hello!"

  REQUIRE(host.pushed.size() == 1);
  auto binary = getBinaryFromData(host.pushed[0]);
  REQUIRE(binary.has_value());
  REQUIRE(std::string(binary->begin(), binary->end()) == "Hello!");

  auto state = svc.getState();
  REQUIRE(state["recentInjectionSize"] == 6);
  REQUIRE(!state.contains("recentInjection"));
}

TEST_CASE("Injector state includes plainText and bypass",
          "[services][injector]") {
  Injector svc("injector-1");
  svc.configure(json{{"plainText", true}, {"bypass", false}});

  auto state = svc.getState();
  REQUIRE(state["plainText"] == true);
  REQUIRE(state["bypass"] == false);
}
