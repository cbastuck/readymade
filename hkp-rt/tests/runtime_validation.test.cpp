#include <catch2/catch_test_macros.hpp>

#include <types/models.h>
#include <types/validation.h>

using namespace hkp;

TEST_CASE("validateRuntime accepts minimal valid runtime configuration", "[runtime]") {
  json runtime = {
    {"id", "rt-1"},
    {"name", "Runtime One"},
    {"services", json::array({
      {
        {"serviceId", "filter"},
        {"uuid", "svc-1"},
        {"name", "Filter One"},
        {"state", {{"open", true}}}
      }
    })}
  };

  auto parsed = validateRuntime(runtime);
  REQUIRE(parsed.has_value());
  REQUIRE(parsed->runtimeId == "rt-1");
  REQUIRE(parsed->runtimeName == "Runtime One");
  REQUIRE(parsed->services.size() == 1);
  REQUIRE(parsed->services[0].serviceId == "filter");
  REQUIRE(parsed->services[0].instanceId == "svc-1");
}

TEST_CASE("validateRuntime rejects malformed runtime configuration", "[runtime]") {
  SECTION("missing runtime id") {
    json runtime = {
      {"name", "No Id"},
      {"services", json::array()}
    };
    REQUIRE_FALSE(validateRuntime(runtime).has_value());
  }

  SECTION("services is not an array") {
    json runtime = {
      {"id", "rt-1"},
      {"name", "Bad Services"},
      {"services", json::object()}
    };
    REQUIRE_FALSE(validateRuntime(runtime).has_value());
  }

  SECTION("service missing uuid") {
    json runtime = {
      {"id", "rt-1"},
      {"name", "Bad Service"},
      {"services", json::array({
        {
          {"serviceId", "filter"},
          {"state", json::object()}
        }
      })}
    };
    REQUIRE_FALSE(validateRuntime(runtime).has_value());
  }
}

TEST_CASE("jsonSerialise preserves runtime and service fields", "[runtime]") {
  RuntimeConfiguration conf;
  conf.runtimeId = "rt-42";
  conf.runtimeName = "Main Runtime";
  conf.boardName = "board-alpha";
  conf.services.push_back(ServiceConfiguration{
    "timer",
    "svc-123",
    "Timer Service",
    json{{"periodic", true}}
  });

  auto serialized = jsonSerialise(conf);
  REQUIRE(serialized["id"] == "rt-42");
  REQUIRE(serialized["name"] == "Main Runtime");
  REQUIRE(serialized["boardName"] == "board-alpha");
  REQUIRE(serialized["services"].size() == 1);
  REQUIRE(serialized["services"][0]["serviceId"] == "timer");
  REQUIRE(serialized["services"][0]["serviceName"] == "Timer Service");
  REQUIRE(serialized["services"][0]["uuid"] == "svc-123");
  REQUIRE(serialized["services"][0]["state"]["periodic"] == true);
}

TEST_CASE("runtime type string parsing roundtrip", "[runtime]") {
  REQUIRE(parseRuntimeType("process") == RuntimeInput::PROCESS);
  REQUIRE(parseRuntimeType("configure") == RuntimeInput::CONFIGURE);
  REQUIRE(parseRuntimeType("external") == RuntimeInput::EXTERNAL);

  REQUIRE(runtimeTypeAsString(RuntimeInput::PROCESS) == "process");
  REQUIRE(runtimeTypeAsString(RuntimeInput::CONFIGURE) == "configure");
  REQUIRE(runtimeTypeAsString(RuntimeInput::EXTERNAL) == "external");

  REQUIRE_THROWS(parseRuntimeType("invalid-type"));
}
