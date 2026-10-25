#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <thread>

#include "nested_fixture.h"
#include "services/gather.h"

using namespace hkp;
using nested_fixture::NestedHost;

// ──────────────────────────────────────────────────────────────────────────────
// The other half of Spread.
//
// The same cases as hkp-node's gather tests. What is worth pinning is when a
// group counts as complete, what it becomes, and what happens to one that never
// completes — the rest is the pipeline's, and pinned where the pipeline is.
// ──────────────────────────────────────────────────────────────────────────────
namespace {

// Joins the items of `{ group, items }` into one text: the reducer a board
// writes as one Map term, without a Map to hand.
class JoinService final : public Service {
public:
  explicit JoinService(const std::string& id) : Service(id, "join") {}
  std::string getServiceId() const override { return "join"; }
  Data process(Data data) override {
    auto j = getJSONFromData(data);
    std::string joined;
    for (const auto& item : (*j)["items"])
      joined += item.get<std::string>();
    return json(joined);
  }
};

class StopService final : public Service {
public:
  explicit StopService(const std::string& id) : Service(id, "stop") {}
  std::string getServiceId() const override { return "stop"; }
  Data process(Data) override { return Null(); }
};

json part(const std::string& group, int64_t index, int64_t total, json item) {
  return json{{"item", std::move(item)}, {"group", group}, {"index", index}, {"total", total}};
}

struct Fixture {
  NestedHost host;
  std::shared_ptr<Gather> gather = std::make_shared<Gather>("gather-1");

  explicit Fixture(json state = json::object()) {
    host.addService(gather);
    host.instances["join"] = std::make_shared<JoinService>("join");
    host.instances["stop"] = std::make_shared<StopService>("stop");
    gather->configure(state);
  }

  json run(json input) {
    auto out = gather->startProcess(input);
    if (isNull(out)) return nullptr;
    auto j = getJSONFromData(out);
    REQUIRE(j.has_value());
    return *j;
  }
};

json pipelineOf(const std::string& instanceId) {
  return json::array({json{{"serviceId", instanceId}, {"instanceId", instanceId}}});
}

} // namespace

TEST_CASE("Gather passes nothing on until every part is in, then in order", "[gather]")
{
  Fixture f;
  REQUIRE(f.run(part("g", 2, 3, "c")).is_null());
  REQUIRE(f.run(part("g", 0, 3, "a")).is_null());
  REQUIRE(f.run(part("g", 1, 3, "b")) == json::array({"a", "b", "c"}));
}

TEST_CASE("Gather keeps groups apart and counts a part sent twice once", "[gather]")
{
  Fixture f;
  f.run(part("one", 0, 2, "1a"));
  f.run(part("two", 0, 2, "2a"));
  REQUIRE(f.run(part("one", 0, 2, "again")).is_null());

  REQUIRE(f.run(part("two", 1, 2, "2b")) == json::array({"2a", "2b"}));
  REQUIRE(f.run(part("one", 1, 2, "1b")) == json::array({"1a", "1b"}));
}

TEST_CASE("Gather says how far a group has got", "[gather]")
{
  Fixture f;
  f.run(part("g", 0, 2, "a"));
  REQUIRE(f.host.notifications.back() ==
          json{{"group", "g"}, {"received", 1}, {"total", 2}, {"pending", 1}});
  REQUIRE(f.gather->getState()["pending"] == 1);
}

TEST_CASE("Gather passes on what is not a part", "[gather]")
{
  Fixture f(json{{"pipeline", pipelineOf("join")}});
  REQUIRE(f.run("a whole file") == "a whole file");
  REQUIRE(f.run(json{{"item", "x"}, {"group", "g"}}) == json{{"item", "x"}, {"group", "g"}});

  // Bytes are not a part either.
  auto bytes = f.gather->startProcess(BinaryData{1, 2, 3});
  REQUIRE(getBinaryFromData(bytes).has_value());
}

TEST_CASE("Gather becomes what its pipeline makes of a complete group", "[gather]")
{
  Fixture f(json{{"pipeline", pipelineOf("join")}});
  f.run(part("g", 1, 2, "world"));
  REQUIRE(f.run(part("g", 0, 2, "hello ")) == "hello world");
}

TEST_CASE("Gather stops when its pipeline stops, or the board says so", "[gather]")
{
  Fixture stops(json{{"pipeline", pipelineOf("stop")}});
  REQUIRE(stops.run(part("g", 0, 1, "a")).is_null());

  Fixture quiet(json{{"stopPropagation", true}});
  REQUIRE(quiet.run(part("g", 0, 1, "a")).is_null());
}

TEST_CASE("Gather refuses a group past maxBytes, and what is still on its way",
          "[gather]")
{
  Fixture f(json{{"maxBytes", 5}});
  REQUIRE(f.run(part("g", 0, 3, "abc")).is_null());
  REQUIRE(f.run(part("g", 1, 3, "def")).is_null());
  // The rest of a refused group does not start it again.
  REQUIRE(f.run(part("g", 2, 3, "g")).is_null());

  auto state = f.gather->getState();
  REQUIRE(state["pending"] == 0);
  REQUIRE(state["error"] == "group g is larger than 5 bytes");
  REQUIRE(f.host.logged == std::vector<std::string>{"error gather.refused"});
}

TEST_CASE("Gather lets go of a group that stopped arriving", "[gather]")
{
  Fixture f(json{{"timeoutMs", 10}});
  f.run(part("old", 0, 2, "a"));
  std::this_thread::sleep_for(std::chrono::milliseconds(20));
  f.run(part("new", 0, 2, "b"));

  REQUIRE(f.gather->getState()["pending"] == 1);
  REQUIRE(f.host.logged == std::vector<std::string>{"warn gather.timed-out"});
  REQUIRE(f.host.logData[0] == json{{"group", "old"}, {"received", 1}, {"total", 2}});
}

TEST_CASE("Gather refuses a group whose parts disagree on how many there are",
          "[gather]")
{
  Fixture f;
  f.run(part("g", 0, 2, "a"));
  REQUIRE(f.run(part("g", 1, 3, "b")).is_null());
  REQUIRE(f.gather->getState()["error"] == "group g said 2 parts, then 3");
}

TEST_CASE("Gather refuses a new group past maxGroups, keeping the ones already arriving",
          "[gather]")
{
  Fixture f(json{{"maxGroups", 2}});
  f.run(part("a", 0, 2, "a0"));
  f.run(part("b", 0, 2, "b0"));
  REQUIRE(f.run(part("c", 0, 2, "c0")).is_null());

  auto state = f.gather->getState();
  REQUIRE(state["pending"] == 2);
  REQUIRE(state["error"] == "group c refused: 2 groups are already incomplete");
  REQUIRE(f.host.logged == std::vector<std::string>{"error gather.refused"});
  // The groups it kept still complete, and the refused one stays refused.
  REQUIRE(f.run(part("a", 1, 2, "a1")) == json::array({"a0", "a1"}));
  REQUIRE(f.run(part("c", 1, 2, "c1")).is_null());
  REQUIRE(f.gather->getState()["pending"] == 1);
}

TEST_CASE("Gather forgets the oldest refusals rather than keeping every one", "[gather]")
{
  Fixture f(json{{"maxGroups", 1}});
  f.run(part("held", 0, 2, "x"));
  for (size_t i = 0; i <= Gather::maxRefused; ++i)
    f.run(part("flood-" + std::to_string(i), 0, 2, "x"));

  // A slot free again: a group still remembered as refused stays refused, one
  // forgotten starts afresh.
  REQUIRE(f.run(part("held", 1, 2, "y")) == json::array({"x", "y"}));
  f.run(part("flood-" + std::to_string(Gather::maxRefused), 1, 2, "x"));
  REQUIRE(f.gather->getState()["pending"] == 0);
  f.run(part("flood-0", 1, 2, "x"));
  REQUIRE(f.gather->getState()["pending"] == 1);
}

TEST_CASE("Gather knows a part when it sees one", "[gather]")
{
  REQUIRE(Gather::isPart(part("g", 0, 1, nullptr)));
  REQUIRE_FALSE(Gather::isPart(json{{"group", "g"}, {"index", 0}, {"total", 1}}));
  REQUIRE_FALSE(Gather::isPart(part("", 0, 1, "x")));
  REQUIRE_FALSE(Gather::isPart(part("g", 1, 1, "x")));
  REQUIRE_FALSE(Gather::isPart(json{{"item", "x"}, {"group", "g"}, {"index", 0.5}, {"total", 2}}));
  REQUIRE_FALSE(Gather::isPart(json::array({part("g", 0, 1, "x")})));
  // A group is held for as long as its parts are, so its name is bounded.
  REQUIRE(Gather::isPart(part(std::string(Gather::maxGroupLength, 'g'), 0, 1, "x")));
  REQUIRE_FALSE(Gather::isPart(part(std::string(Gather::maxGroupLength + 1, 'g'), 0, 1, "x")));

  // A total that large is held without being allocated for.
  Fixture f;
  REQUIRE(f.run(part("g", 0, int64_t(1) << 40, "a")).is_null());
  REQUIRE(f.gather->getState()["pending"] == 1);
}

TEST_CASE("Gather reads its limits from the board as well as later", "[gather]")
{
  Fixture f(json{{"maxBytes", 1000}, {"maxGroups", 4}, {"timeoutMs", 5000}});
  REQUIRE(f.gather->getState()["maxBytes"] == 1000);
  REQUIRE(f.gather->getState()["maxGroups"] == 4);
  f.gather->configure(json{{"maxBytes", 2000}, {"maxGroups", 0}});
  REQUIRE(f.gather->getState()["maxBytes"] == 2000);
  // Fewer than one group would refuse everything; it is not taken.
  REQUIRE(f.gather->getState()["maxGroups"] == 4);
  REQUIRE(f.gather->getState()["timeoutMs"] == 5000);
  REQUIRE(Gather::serviceId() == "gather");
}
