#include <catch2/catch_test_macros.hpp>

#include <types/data.h>

#include <services/hold.h>

using namespace hkp;

namespace {

// What an http-server request arrives as: no producer property in sight.
const json kRequest = json{
  { "meta", json{ { "method", "GET" }, { "path", "/" } } }
};

Hold makeHold(const std::string& property)
{
  Hold hold("hold-1");
  hold.configure(json{ { "property", property } });
  return hold;
}

json stateOf(const Hold& hold)
{
  return hold.getState();
}

} // namespace

TEST_CASE("Hold emits the named property under the same name", "[services][hold]") {
  auto hold = makeHold("triggerCount");

  auto out = getJSONFromData(hold.process(json{ { "triggerCount", 1 } }));
  REQUIRE(out.has_value());
  REQUIRE(*out == json{ { "triggerCount", 1 } });

  const auto state = stateOf(hold);
  REQUIRE(state["held"] == 1);
  REQUIRE(state["writeCount"] == 1);
}

TEST_CASE("Hold emits the same shape whichever side calls", "[services][hold]") {
  auto hold = makeHold("triggerCount");

  auto written = getJSONFromData(hold.process(json{ { "triggerCount", 4 } }));
  auto read = getJSONFromData(hold.process(kRequest));

  // What the services after Hold see does not say which side called; only the
  // counts, which nothing downstream sees, tell them apart.
  REQUIRE(written.has_value());
  REQUIRE(read.has_value());
  REQUIRE(*read == *written);

  const auto state = stateOf(hold);
  REQUIRE(state["readCount"] == 1);
  REQUIRE(state["writeCount"] == 1);
}

TEST_CASE("Hold replays without consuming", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 4 } });

  REQUIRE(*getJSONFromData(hold.process(kRequest)) == json{ { "triggerCount", 4 } });
  REQUIRE(*getJSONFromData(hold.process(kRequest)) == json{ { "triggerCount", 4 } });
}

TEST_CASE("Hold keeps the newest value written", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 1 } });
  hold.process(json{ { "triggerCount", 2 } });

  REQUIRE(*getJSONFromData(hold.process(kRequest)) == json{ { "triggerCount", 2 } });
}

TEST_CASE("Hold drops everything but the held property", "[services][hold]") {
  // A producer's other fields are not part of what is held.
  auto hold = makeHold("triggerCount");

  auto out = getJSONFromData(
    hold.process(json{ { "triggerCount", 5 }, { "note", "ignored" } }));
  REQUIRE(*out == json{ { "triggerCount", 5 } });
}

TEST_CASE("Hold stops while nothing is held", "[services][hold]") {
  auto hold = makeHold("triggerCount");

  REQUIRE(isNull(hold.process(kRequest)));
  REQUIRE(stateOf(hold)["held"].is_null());
}

TEST_CASE("Hold reads on inputs that cannot carry a property", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 6 } });

  REQUIRE(*getJSONFromData(hold.process(json::array({ 1, 2, 3 })))
          == json{ { "triggerCount", 6 } });
}

TEST_CASE("Hold reads on a null value, which is nothing to hold", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 2 } });

  auto out = getJSONFromData(hold.process(json{ { "triggerCount", nullptr } }));
  REQUIRE(*out == json{ { "triggerCount", 2 } });

  const auto state = stateOf(hold);
  REQUIRE(state["readCount"] == 1);
  REQUIRE(state["writeCount"] == 1);
}

TEST_CASE("Hold passes input through while no property is configured", "[services][hold]") {
  Hold hold("hold-1");

  auto out = getJSONFromData(hold.process(kRequest));
  REQUIRE(out.has_value());
  REQUIRE(*out == kRequest);
  REQUIRE(stateOf(hold)["held"].is_null());
}

TEST_CASE("Hold forgets the held value and the counts on clear", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 3 } });
  hold.process(kRequest);

  hold.configure(json{ { "action", "clear" } });

  // The counts described the value that was just discarded.
  const auto state = stateOf(hold);
  REQUIRE(state["held"].is_null());
  REQUIRE(state["readCount"] == 0);
  REQUIRE(state["writeCount"] == 0);
  REQUIRE(isNull(hold.process(kRequest)));
}

TEST_CASE("Hold forgets what it held when the property changes", "[services][hold]") {
  // What was held belonged to the old property name.
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 3 } });

  hold.configure(json{ { "property", "counter" } });

  REQUIRE(stateOf(hold)["held"].is_null());
  REQUIRE(stateOf(hold)["writeCount"] == 0);
  REQUIRE(isNull(hold.process(kRequest)));
}

TEST_CASE("Hold keeps its value when the property is reconfigured to itself",
          "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 3 } });

  hold.configure(json{ { "property", "triggerCount" } });

  REQUIRE(stateOf(hold)["held"] == 3);
  REQUIRE(stateOf(hold)["writeCount"] == 1);
}

TEST_CASE("Hold passes input through when bypassed", "[services][hold]") {
  // Bypass is handled by the base, which never calls process at all.
  auto hold = makeHold("triggerCount");
  hold.configure(json{ { "bypass", true } });

  auto out = getJSONFromData(hold.startProcess(kRequest));
  REQUIRE(out.has_value());
  REQUIRE(*out == kRequest);
}
