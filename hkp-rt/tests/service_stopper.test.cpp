#include <catch2/catch_test_macros.hpp>

#include <types/data.h>

#include <services/stopper.h>

using namespace hkp;

TEST_CASE("Stopper returns Null so the runtime stops there", "[services][stopper]") {
  Stopper stopper("stop-1");
  REQUIRE(isNull(stopper.process(json{{"value", 42}})));
}

TEST_CASE("Stopper passes input through when bypassed", "[services][stopper]") {
  // Bypass is handled by the base, which never calls process at all — it is the
  // lever for reopening a chain without moving services around.
  Stopper stopper("stop-1");
  stopper.configure(json{{"bypass", true}});

  auto in = json{{"kept", true}};
  auto out = stopper.startProcess(in);
  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE(*jsonOut == in);
}
