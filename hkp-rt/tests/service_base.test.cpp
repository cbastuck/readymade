#include <catch2/catch_test_macros.hpp>

#include <service.h>
#include <types/data.h>

using namespace hkp;

namespace {
class TestService final : public Service {
public:
  explicit TestService(const std::string& instanceId)
    : Service(instanceId, "test-service") {
  }

  std::string getServiceId() const override {
    return "test-service";
  }

  Data process(Data data) override {
    ++processCalls;
    return data;
  }

  int processCalls = 0;
};
} // namespace

TEST_CASE("Service bypass defaults to false after first configure", "[services]") {
  TestService service("svc-1");

  auto state = service.configure(json::object());
  REQUIRE(state["bypass"] == false);
  REQUIRE(service.getState()["bypass"] == false);
}

TEST_CASE("Service startProcess respects bypass flag", "[services]") {
  TestService service("svc-1");
  service.configure(json{{"bypass", false}});

  auto input = json{{"x", 1}};
  auto output = service.startProcess(input);
  REQUIRE(service.processCalls == 1);
  auto jsonOut = getJSONFromData(output);
  REQUIRE(jsonOut.has_value());
  REQUIRE((*jsonOut)["x"] == 1);

  service.configure(json{{"bypass", true}});
  auto outputBypassed = service.startProcess(json{{"x", 2}});
  REQUIRE(service.processCalls == 1);
  auto jsonBypassed = getJSONFromData(outputBypassed);
  REQUIRE(jsonBypassed.has_value());
  REQUIRE((*jsonBypassed)["x"] == 2);
}

TEST_CASE("Service next throws when runtime is not connected", "[services]") {
  TestService service("svc-1");
  service.configure(json::object());

  REQUIRE_THROWS(service.next(json{{"x", 1}}));
  REQUIRE_THROWS(service.nextAsync(json{{"x", 1}}, [](Data) {}));
  REQUIRE_THROWS(service.isConnected());
}
