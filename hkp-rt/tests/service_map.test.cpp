#include <catch2/catch_test_macros.hpp>

#include <types/data.h>
#include <services/map.h>

using namespace hkp;

namespace {

json mapped(Map& map, const json& input)
{
  auto out = map.process(input);
  auto result = getJSONFromData(out);
  REQUIRE(result.has_value());
  return *result;
}

} // namespace

// ── Inja templates (the dialect this service shipped with) ───────────────────

TEST_CASE("Map returns null for non-JSON input", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", "{{ value }}"}});

  auto out = map.process(std::string("not-json"));
  REQUIRE(isNull(out));
}

// The mapping UI edits rows, so a fresh service must report an object rather
// than null, and it must map with it instead of stopping the flow.
TEST_CASE("Map starts with an empty template", "[services][map]") {
  Map map("map-1");

  REQUIRE(map.getState()["template"] == json::object());
  REQUIRE(mapped(map, json{{"value", 42}}) == json::object());

  SECTION("an empty template passes the input through in a merge mode") {
    map.configure(json{{"mode", "overwrite"}});
    REQUIRE(mapped(map, json{{"value", 42}}) == json{{"value", 42}});
  }

  SECTION("a null template is stored as an empty object") {
    map.configure(json{{"template", nullptr}});
    REQUIRE(map.getState()["template"] == json::object());
    REQUIRE(mapped(map, json{{"value", 42}}) == json::object());
  }
}

TEST_CASE("Map applies template to object values", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"answer", "{{ value }}"}}}});

  REQUIRE(mapped(map, json{{"value", 42}})["answer"] == "42");
}

TEST_CASE("Map supports '=' root shorthand", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"=", "{{ value }}"}}}});

  REQUIRE(mapped(map, json{{"value", "hello"}}) == "hello");
}

TEST_CASE("Map keeps rendering inja keys and nested templates", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{
    {"{{ name }}", "static"},
    {"nested", json{{"inner", "{{ value }}"}}}}}});

  const json out = mapped(map, json{{"name", "key"}, {"value", 7}});
  REQUIRE(out["key"] == "static");
  REQUIRE(out["nested"]["inner"] == "7");
}

// ── Expression terms (the dialect the shared Map UI writes) ──────────────────

TEST_CASE("Map evaluates dynamic terms as expressions", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{
    {"label", "hello"},
    {"answer=", "params.value * 2"}}}});

  const json out = mapped(map, json{{"value", 21}});
  REQUIRE(out["label"] == "hello");
  REQUIRE(out["answer"] == 42);
}

TEST_CASE("Map maps to a scalar for a lone '=' expression", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"=", "params.value + 1"}}}});

  REQUIRE(mapped(map, json{{"value", 1}}) == 2);
}

TEST_CASE("Map nests dotted keys", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{
    {"position.x=", "params.n"},
    {"position.y", 0}}}});

  const json out = mapped(map, json{{"n", 3}});
  REQUIRE(out["position"]["x"] == 3);
  REQUIRE(out["position"]["y"] == 0);
}

TEST_CASE("Map exposes the shared helper functions", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{
    {"rounded=", "round(params.value)"},
    {"joined=", "concat('a', 'b')"},
    {"total=", "sum(params.list)"},
    {"picked=", "find(params.list, 'item > 1')"}}}});

  const json out = mapped(map, json{{"value", 1.6}, {"list", {1, 2, 3}}});
  REQUIRE(out["rounded"] == 2);
  REQUIRE(out["joined"] == "ab");
  REQUIRE(out["total"] == 6);
  REQUIRE(out["picked"] == 2);
}

TEST_CASE("Map returns the input unchanged when an expression fails", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"x=", "nope("}}}});

  REQUIRE(mapped(map, json{{"value", 1}}) == json{{"value", 1}});
}

// ── Modes ────────────────────────────────────────────────────────────────────

TEST_CASE("Map honours the merge modes", "[services][map]") {
  const json templateNode = json{{"value=", "params.value * 2"}, {"extra", true}};
  const json input = json{{"value", 2}, {"keep", 1}};

  SECTION("replace keeps only the template output") {
    Map map("map-1");
    map.configure(json{{"template", templateNode}, {"mode", "replace"}});

    const json out = mapped(map, input);
    REQUIRE(out == json{{"value", 4}, {"extra", true}});
  }

  SECTION("overwrite lets the template win") {
    Map map("map-1");
    map.configure(json{{"template", templateNode}, {"mode", "overwrite"}});

    const json out = mapped(map, input);
    REQUIRE(out == json{{"value", 4}, {"keep", 1}, {"extra", true}});
  }

  SECTION("add lets the input win") {
    Map map("map-1");
    map.configure(json{{"template", templateNode}, {"mode", "add"}});

    const json out = mapped(map, input);
    REQUIRE(out == json{{"value", 2}, {"keep", 1}, {"extra", true}});
  }
}

// ── Arrays ───────────────────────────────────────────────────────────────────

TEST_CASE("Map maps each element of an array input", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"n=", "params.n + 1"}}}});

  const json out = mapped(map, json::array({json{{"n", 1}}, json{{"n", 2}}}));
  REQUIRE(out == json::array({json{{"n", 2}}, json{{"n", 3}}}));
}

TEST_CASE("Map maps the array as a whole in arrayMode 'single'", "[services][map]") {
  Map map("map-1");
  map.configure(json{
    {"arrayMode", "single"},
    {"template", json{{"count=", "params.length"}}}});

  REQUIRE(mapped(map, json::array({1, 2, 3}))["count"] == 3);
}

TEST_CASE("Map keeps array templates as arrays", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json::array({
    json{{"role", "user"}},
    json{{"text=", "params.text"}}})}});

  const json out = mapped(map, json{{"text", "hi"}});
  REQUIRE(out == json::array({json{{"role", "user"}}, json{{"text", "hi"}}}));
}

// ── Sensing ──────────────────────────────────────────────────────────────────

TEST_CASE("Map learns a flat template in sensing mode", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"sensingMode", true}});

  REQUIRE(isNull(map.process(json{{"a", json{{"b", 1}}}, {"c", "x"}})));

  const json state = map.getState();
  REQUIRE(state["sensingMode"] == false);
  REQUIRE(state["template"] == json{{"a.b", 1}, {"c", "x"}});
  REQUIRE(mapped(map, json::object()) == json{{"a", json{{"b", 1}}}, {"c", "x"}});
}

// ── State ────────────────────────────────────────────────────────────────────

TEST_CASE("Map reports its configuration", "[services][map]") {
  Map map("map-1");
  map.configure(json{
    {"template", json{{"x=", "params.x"}}},
    {"mode", "add"},
    {"arrayMode", "single"}});

  const json state = map.getState();
  REQUIRE(state["mode"] == "add");
  REQUIRE(state["arrayMode"] == "single");
  REQUIRE(state["sensingMode"] == false);
  REQUIRE(state["template"] == json{{"x=", "params.x"}});
  REQUIRE(Map::version() == "v1");
}
