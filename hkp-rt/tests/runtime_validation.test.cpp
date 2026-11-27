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

TEST_CASE("resource references, payload reading, and ResourceStore resolution", "[resources]") {
  REQUIRE(parseResourceRef("hkp-resource://llm") == std::optional<std::string>("llm"));
  REQUIRE_FALSE(parseResourceRef("http://hkp-resource://llm").has_value());

  std::vector<std::string> refs;
  findResourceRefs(
    json{
      {"endpoint", "hkp-resource://llm"},
      {"nested", json::array({json{{"expr", "x ? 'hkp-resource://db' : 'hkp-resource://llm'"}}})},
    },
    refs);
  REQUIRE(refs == std::vector<std::string>{"llm", "db"});

  const json ollamaBinding = {
    {"id", "llm"},
    {"kind", "ollama"},
    {"url", "http://127.0.0.1:11434"},
  };
  const json pgBinding = {
    {"id", "db"},
    {"kind", "postgres"},
    {"url", "postgres://127.0.0.1:5432/app"},
    {"user", "app"},
    {"password", "secret"},
    {"database", "app"},
  };

  auto payload = readResourcesPayload(json{
    {"llm", ollamaBinding},
    {"db", pgBinding},
    {"gone", nullptr},
    {"invalid", {{"kind", "unknown"}}},
  });
  REQUIRE(payload.size() == 3);
  REQUIRE(payload.at("llm") == ollamaBinding);
  REQUIRE(payload.at("db") == pgBinding);
  REQUIRE(payload.at("gone").is_null());

  ResourceStore store;
  std::vector<std::string> changed;
  store.subscribe("llm", [&](const std::string& id) { changed.push_back(id); });
  store.replace(payload);
  REQUIRE(changed == std::vector<std::string>{"llm"});
  REQUIRE(store.ids() == std::vector<std::string>{"db", "llm"});

  auto ok = store.resolve("hkp-resource://llm", "ollama");
  REQUIRE(ok.resource.has_value());
  REQUIRE((*ok.resource)["url"] == "http://127.0.0.1:11434");
  REQUIRE(ok.problem.empty());

  auto wrongKind = store.resolve("hkp-resource://llm", "postgres");
  REQUIRE_FALSE(wrongKind.resource.has_value());
  REQUIRE(wrongKind.problem == "resource \"llm\" is of kind \"ollama\", not \"postgres\"");

  auto missing = store.resolve("hkp-resource://missing");
  REQUIRE_FALSE(missing.resource.has_value());
  REQUIRE(missing.problem == "resource \"missing\" is not bound");

  json unreachableBinding = ollamaBinding;
  unreachableBinding["unreachable"] = "resource \"llm\" is bound to 127.0.0.1 on another machine";
  store.merge({{"llm", unreachableBinding}, {"db", nullptr}});
  REQUIRE(store.ids() == std::vector<std::string>{"llm"});
  auto unreachable = store.resolve("hkp-resource://llm", "ollama");
  REQUIRE_FALSE(unreachable.resource.has_value());
  REQUIRE(unreachable.problem == "resource \"llm\" is bound to 127.0.0.1 on another machine");

  json runtime = {
    {"id", "rt-res"},
    {"name", "Runtime With Resources"},
    {"resources", {{"llm", ollamaBinding}}},
    {"services", json::array()},
  };
  auto parsed = validateRuntime(runtime);
  REQUIRE(parsed.has_value());
  REQUIRE(parsed->resources.size() == 1);
  REQUIRE(parsed->resources.at("llm") == ollamaBinding);
}
