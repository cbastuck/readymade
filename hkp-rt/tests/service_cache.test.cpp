#include <catch2/catch_test_macros.hpp>

#include <types/data.h>
#include <services/cache.h>

using namespace hkp;

TEST_CASE("Cache returns null for non-JSON input", "[services][cache]") {
  Cache cache("cache-1");
  auto out = cache.process(std::string("not-json"));
  REQUIRE(isNull(out));
}

TEST_CASE("Cache passes through when key is missing", "[services][cache]") {
  Cache cache("cache-1");
  cache.configure(json{{"key", "id"}});

  auto in = json{{"other", "value"}};
  auto out = cache.process(in);

  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE(*jsonOut == in);
}

TEST_CASE("Cache excluded patterns bypass cache and pass through", "[services][cache]") {
  Cache cache("cache-1");
  cache.configure(json{{"key", "id"}, {"excluded", json::array({"^skip"})}});

  auto in = json{{"id", "skip-this"}, {"payload", 7}};
  auto out = cache.process(in);

  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE(*jsonOut == in);
}

TEST_CASE("Cache state includes configured fields", "[services][cache]") {
  Cache cache("cache-1");
  cache.configure(json{
    {"key", "id"},
    {"persistRoot", "/tmp/hkp-cache"},
    {"cacheDuration", "12h"},
    {"excluded", json::array({"^foo", "bar$"})},
    {"bypass", false}
  });

  auto state = cache.getState();
  REQUIRE(state["key"] == "id");
  REQUIRE(state["persistRoot"] == "/tmp/hkp-cache");
  REQUIRE(state["cacheDuration"] == "12h");
  REQUIRE(state["excluded"].is_array());
  REQUIRE(state["excluded"].size() == 2);
  REQUIRE(state["bypass"] == false);
}
