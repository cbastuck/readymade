#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>

#include <types/data.h>
#include <services/map.h>
#include "runtime_host.h"
#include "sub_runtime.h"

using namespace hkp;

namespace {

json mapped(Map& map, const json& input)
{
  auto out = map.process(input);
  auto result = getJSONFromData(out);
  REQUIRE(result.has_value());
  return *result;
}

// Keeps what a Map notifies; nothing here runs a pipeline.
class RecordingHost final : public RuntimeHost {
public:
  std::vector<json> notifications;
  std::vector<std::pair<LogLevel, std::string>> logs;
  std::vector<json> logData;

  Data processFrom(const Service&, Data data, bool, std::function<void(Data)>) override
  {
    return data;
  }
  void post(std::function<void()> fn) override { fn(); }
  void scheduleProcessFrom(const Service&, Data, bool) override {}
  bool isConnected(const Service&) const override { return true; }
  void sendData(Data data, MessagePurpose purpose, const std::string&,
                std::function<void(Data)>) override
  {
    if (purpose == MessagePurpose::NOTIFICATION)
    {
      notifications.push_back(*getJSONFromData(data));
    }
  }
  void notifyProcessFinished(const Service&, const Data&) override {}
  void log(const Service&, LogLevel level, const std::string& event, const nlohmann::json& data) override
  {
    logs.emplace_back(level, event);
    logData.push_back(data);
  }
  void forwardLog(const LogEntry&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }
  std::shared_ptr<SubRuntime> createSubRuntime(const Service&, const json&) override
  {
    return nullptr;
  }

  // What was said about the pass: its error and its warnings, in order.
  std::vector<json> reported() const
  {
    std::vector<json> out;
    for (const auto& n : notifications)
    {
      if (n.contains("error") || n.contains("warnings"))
      {
        out.push_back(n);
      }
    }
    return out;
  }

private:
  SecretVault m_vault;
  SlotStore m_slots;
};

} // namespace

// ── Inja templates (the dialect this service shipped with) ───────────────────

TEST_CASE("Map returns null for non-JSON input", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", "{{ value }}"}});

  auto out = map.process(std::string("not-json"));
  REQUIRE(isNull(out));
}

// A Map at the head of a board, run without anything before it.
TEST_CASE("Map builds its template without input", "[services][map]") {
  for (const std::string mode : {"replace", "add", "overwrite"}) {
    Map map("map-1");
    map.configure(json{{"mode", mode},
                       {"template", json{{"text=", "concat('Today is ', '2')"},
                                         {"source", "clock"}}}});

    auto result = getJSONFromData(map.process(Undefined()));
    REQUIRE(result.has_value());
    REQUIRE(*result == json{{"text", "Today is 2"}, {"source", "clock"}});
  }
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

// ── Missing reads, warnings and errors ───────────────────────────────────────
// What a pass says about itself — the same in every runtime (browser Map.ts,
// hkp-node map.ts, hkp-python map_service.py).

TEST_CASE("Map maps a read that found nothing to null, and warns", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"title=", "params.titel"}, {"x=", "params.missing.deep"}}}});

  REQUIRE(mapped(map, json{{"title", "Hello"}}) == json{{"title", nullptr}, {"x", nullptr}});
  REQUIRE(host.reported() == std::vector<json>{
    json{{"warnings", {"title: params.titel not found", "x: params.missing not found"}}}});
}

TEST_CASE("Map does not warn about a read a fallback covered, or a null value", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"slug=", "params.id || params.link"}, {"none=", "params.none"}}}});

  REQUIRE(mapped(map, json{{"link", "l"}, {"none", nullptr}}) ==
          json{{"slug", "l"}, {"none", nullptr}});
  REQUIRE(host.reported().empty());
}

TEST_CASE("Map stops the flow on a failing term, says why, and clears it once it works", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"x=", "nope(params.n)"}}}});

  REQUIRE(isNull(map.process(json::object())));
  map.configure(json{{"template", json{{"x=", "params.n"}}}});
  REQUIRE(mapped(map, json{{"n", 2}}) == json{{"x", 2}});
  REQUIRE(host.reported() == std::vector<json>{
    json{{"error", "x: unknown function 'nope'"}},
    json{{"error", ""}}});
}

TEST_CASE("Map fails an array input when one element fails", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"n=", "params.n"}, {"x=", "params.n > 1 ? nope() : 0"}}}});

  REQUIRE(mapped(map, json::array({json{{"n", 1}}})) == json::array({json{{"n", 1}, {"x", 0}}}));
  REQUIRE(isNull(map.process(json::array({json{{"n", 1}}, json{{"n", 2}}}))));
}

TEST_CASE("Map says a term does not parse as soon as it is configured", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"x=", "nope("}}}});

  const auto reported = host.reported();
  REQUIRE(reported.size() == 1);
  REQUIRE(reported[0]["error"].get<std::string>().starts_with("x: invalid expression 'nope('"));
  REQUIRE(isNull(map.process(json::object())));
}

TEST_CASE("Map names a term in a structured template by where it sits", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"items", json::array({json{{"title=", "params.titel"}}})}}}});

  REQUIRE(mapped(map, json::object()) ==
          json{{"items", json::array({json{{"title", nullptr}}})}});
  REQUIRE(host.reported() == std::vector<json>{
    json{{"warnings", {"items.0.title: params.titel not found"}}}});
}

TEST_CASE("Map warns about a read through a field that is there but null", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"name=", "params.author.name"}}}});

  REQUIRE(mapped(map, json{{"author", nullptr}}) == json{{"name", nullptr}});
  REQUIRE(host.reported() == std::vector<json>{
    json{{"warnings", {"name: params.author.name not found"}}}});
}

TEST_CASE("Map logs a failing pass, since nobody may be watching", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"x=", "nope(params.n)"}}}});

  map.process(json::object());
  map.process(json::object());
  REQUIRE(host.logs.size() == 2);
  REQUIRE(host.logs[0] == std::pair<LogLevel, std::string>{LogLevel::Error, "service.failed"});
  REQUIRE(host.logData[0] == json{{"message", "x: unknown function 'nope'"}});
}

TEST_CASE("Map keeps what it says in its state while it says something", "[services][map]") {
  Map map("map-1");
  RecordingHost host;
  map.setParentHost(host);
  map.configure(json{{"template", json{{"x=", "nope(params.n)"}}}});

  map.process(json::object());
  REQUIRE(map.getState()["error"] == "x: unknown function 'nope'");

  map.configure(json{{"template", json{{"x=", "params.missing"}}}});
  map.process(json::object());
  REQUIRE_FALSE(map.getState().contains("error"));
  REQUIRE(map.getState()["warnings"] == json::array({"x: params.missing not found"}));

  map.process(json{{"missing", 1}});
  REQUIRE_FALSE(map.getState().contains("warnings"));
}

TEST_CASE("Map names a failing term the same when configured and on a pass", "[services][map]") {
  const std::vector<std::pair<json, std::string>> cases{
    {json{{"=", "bad("}, {"x=", "1"}}, "="},
    {json{{"items", json{{"=", "bad("}}}, {"other", json::array({1})}}, "items"},
  };
  for (const auto& [templateNode, name] : cases)
  {
    Map map("map-1");
    RecordingHost host;
    map.setParentHost(host);
    map.configure(json{{"template", templateNode}});
    map.process(json::object());

    const auto reported = host.reported();
    REQUIRE(reported.size() == 1);
    REQUIRE(reported[0]["error"].get<std::string>().starts_with(name + ": invalid expression 'bad('"));
  }
}

// ── A lone "=": the value of its term, the same in every runtime ─────────────

TEST_CASE("Map's lone '=' whose read found nothing stops the flow", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{{"=", "params.missing"}}}});

  REQUIRE(isNull(map.process(json::object())));
}

TEST_CASE("Map's lone '=' is its value whatever the mode", "[services][map]") {
  for (const std::string mode : {"add", "overwrite"})
  {
    Map map("map-1");
    map.configure(json{{"mode", mode}, {"template", json{{"=", "params.inner"}}}});

    REQUIRE(mapped(map, json{{"inner", json{{"a", 1}}}, {"b", 2}}) == json{{"a", 1}});
  }
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

TEST_CASE("Map senses what arrived as data, not as a template that runs", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"sensingMode", true}});

  const json arrived{
    {"pwned=", "params.secret"},
    {"inja", "{% include \"/etc/hosts\" %}{{ secret }}"},
    {"{{ secret }}", "key"},
    {"lines", "{{ a }}\n## for x in [1]\n{# note #}"},
    {"plain", "#1 {not a marker}"},
  };
  REQUIRE(isNull(map.process(arrived)));

  // Every field comes back exactly as it arrived, the suffix aside: nothing in
  // it was evaluated or rendered against the next input.
  json expected = arrived;
  expected.erase("pwned=");
  expected["pwned"] = "params.secret";
  REQUIRE(mapped(map, json{{"secret", "s"}, {"a", 1}}) == expected);
}

TEST_CASE("Map's Inja templates cannot include a file", "[services][map]") {
  const auto path = std::filesystem::temp_directory_path() / "hkp-map-include.txt";
  {
    std::ofstream file(path);
    file << "file contents";
  }

  Map map("map-1");
  const std::string include = "{% include \"" + path.string() + "\" %}";
  map.configure(json{{"template", json{{"x", include}}}});

  REQUIRE(mapped(map, json::object()) == json{{"x", include}});
  std::filesystem::remove(path);
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

// ── join: what a gather collected, as one text ───────────────────────────────

TEST_CASE("Map joins an array into one text", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{
    {"whole=", "join(params.items)"},
    {"csv=", "join(params.items, ',')"},
  }}});

  REQUIRE(mapped(map, json{{"items", json::array({"ab", "cd", nullptr, 1, true})}}) ==
          json{{"whole", "abcd1true"}, {"csv", "ab,cd,,1,true"}});
  REQUIRE_FALSE(map.getState().contains("error"));
}

TEST_CASE("Map's join answers with text whatever it is given", "[services][map]") {
  Map map("map-1");
  map.configure(json{{"template", json{
    {"missing=", "join(params.missing)"},
    {"whole=", "join(params.s)"},
  }}});

  REQUIRE(mapped(map, json{{"s", "whole"}}) == json{{"missing", ""}, {"whole", "whole"}});
}
