#include <catch2/catch_test_macros.hpp>

#include "nested_fixture.h"
#include "services/iterator.h"

using namespace hkp;
using nested_fixture::FakeItemService;
using nested_fixture::NestedHost;

// ──────────────────────────────────────────────────────────────────────────────
// Iteration as a service.
//
// The same cases as hkp-node's iterator tests: one board reads the same
// whichever runtime hosts it. What is worth pinning is the shape of the loop —
// how many times the nested pipeline runs, what comes back, and what happens
// when one item goes wrong.
// ──────────────────────────────────────────────────────────────────────────────
namespace {

struct Fixture {
  NestedHost host;
  std::shared_ptr<Iterator> iterator = std::make_shared<Iterator>("iter-1");

  explicit Fixture(json nested = json::object(), json state = json::object()) {
    host.addService(iterator);
    host.instances["inner-1"] = std::make_shared<FakeItemService>("inner-1", nested);
    FakeItemService::seen().clear();
    state["pipeline"] = json::array({json{{"serviceId", "fake"}, {"instanceId", "inner-1"}}});
    iterator->configure(state);
  }

  json run(Data input) {
    auto out = iterator->startProcess(input);
    if (isNull(out)) return nullptr;
    auto j = getJSONFromData(out);
    REQUIRE(j.has_value());
    return *j;
  }
};

} // namespace

TEST_CASE("Iterator runs the nested pipeline once per element", "[iterator]")
{
  Fixture f;
  REQUIRE(f.run(json::array({1, 2, 3})) == json::array({2, 4, 6}));
  REQUIRE(FakeItemService::seen() == std::vector<json>{1, 2, 3});
}

TEST_CASE("Iterator treats a single item as an array of one", "[iterator]")
{
  Fixture f;
  REQUIRE(f.run(json(7)) == json::array({14}));

  // An object is one item, not its values.
  REQUIRE(f.run(json{{"a", 1}}) == json::array({json{{"saw", {{"a", 1}}}}}));
}

TEST_CASE("Iterator reaches into a result and stops at the limit", "[iterator]")
{
  Fixture f(json::object(), json{{"itemsFrom", "page.rows"}, {"limit", 2}});
  f.run(json{{"page", {{"rows", {1, 2, 3, 4}}}}, {"count", 4}});
  REQUIRE(FakeItemService::seen() == std::vector<json>{1, 2});
}

TEST_CASE("Iterator does nothing at all with nothing to do", "[iterator]")
{
  Fixture f;
  REQUIRE(f.run(json::array()).is_null());
  REQUIRE(f.run(json(nullptr)).is_null());
  REQUIRE(FakeItemService::seen().empty());
}

TEST_CASE("Iterator drops the items whose pipeline stopped", "[iterator]")
{
  Fixture f(json{{"stopOn", 2}});
  REQUIRE(f.run(json::array({1, 2, 3})) == json::array({2, 6}));

  // Nothing collected at all passes nothing on, and still says so.
  f.host.notifications.clear();
  REQUIRE(f.run(json::array({2})).is_null());
  REQUIRE(f.host.notifications.back() == json{{"items", 1}, {"results", 0}, {"failed", 0}});
}

TEST_CASE("Iterator keeps going when one item fails, and counts it", "[iterator]")
{
  // Nine conversations should not go unprocessed because the tenth had a
  // malformed address.
  Fixture f(json{{"failOn", 2}});
  REQUIRE(f.run(json::array({1, 2, 3})) == json::array({2, 6}));
  REQUIRE(FakeItemService::seen().size() == 3);
  REQUIRE(f.host.notifications.back() == json{{"items", 3}, {"results", 2}, {"failed", 1}});
  REQUIRE(f.host.logged == std::vector<std::string>{"error service.failed"});
  REQUIRE(f.host.logData[0]["message"].get<std::string>().find("malformed") != std::string::npos);
  REQUIRE(f.iterator->getState()["lastFailed"] == 1);
}

TEST_CASE("Iterator with nothing in it, or bypassed, passes its input through",
          "[iterator]")
{
  NestedHost host;
  auto empty = std::make_shared<Iterator>("iter-1");
  host.addService(empty);
  empty->configure(json{{"pipeline", json::array()}});
  REQUIRE(*getJSONFromData(empty->startProcess(json::array({1, 2}))) == json::array({1, 2}));

  Fixture f(json::object(), json{{"bypass", true}});
  REQUIRE(f.run(json::array({1, 2})) == json::array({1, 2}));
  REQUIRE(FakeItemService::seen().empty());
}

TEST_CASE("Iterator reports what it iterates over beside its pipeline", "[iterator]")
{
  Fixture f(json::object(), json{{"itemsFrom", "rows"}, {"limit", 5}});
  auto state = f.iterator->getState();
  REQUIRE(state["itemsFrom"] == "rows");
  REQUIRE(state["limit"] == 5);
  REQUIRE(state["pipeline"][0]["instanceId"] == "inner-1");
  REQUIRE(Iterator::serviceId() == "iterator");
}
