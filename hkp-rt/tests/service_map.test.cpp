#include <catch2/catch_test_macros.hpp>

#include <types/data.h>
#include <services/map.h>

using namespace hkp;

TEST_CASE("Map returns null for non-JSON input", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", "{{ value }}"}});

  auto out = map.process(std::string("not-json"));
  REQUIRE(isNull(out));
}

TEST_CASE("Map returns null when template is not configured", "[services][map]") {
  Map map("map-1");

  auto out = map.process(json{{"value", 42}});
  REQUIRE(isNull(out));
}

TEST_CASE("Map applies template to object values", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"answer", "{{ value }}"}}}});

  auto out = map.process(json{{"value", 42}});
  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE((*jsonOut)["answer"] == "42");
}

TEST_CASE("Map supports '=' root shorthand", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"=", "{{ value }}"}}}});

  auto out = map.process(json{{"value", "hello"}});
  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE(*jsonOut == "hello");
}
