#include <catch2/catch_test_macros.hpp>

#include <types/data.h>
#include <services/static.h>

using namespace hkp;

TEST_CASE("Static service returns configured output", "[services][static]") {
  Static svc("static-1");

  svc.configure(json{{"out", json{{"x", 1}, {"label", "ok"}}}});

  auto out = svc.process(json{{"ignored", true}});
  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE((*jsonOut)["x"] == 1);
  REQUIRE((*jsonOut)["label"] == "ok");
}

TEST_CASE("Static service state includes out and bypass", "[services][static]") {
  Static svc("static-1");
  svc.configure(json{{"out", 123}, {"bypass", false}});

  auto state = svc.getState();
  REQUIRE(state["out"] == 123);
  REQUIRE(state["bypass"] == false);
}
