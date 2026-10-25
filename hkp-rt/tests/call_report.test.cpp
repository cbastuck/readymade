#include <catch2/catch_test_macros.hpp>

#include <chrono>

#include <call_report.h>
#include "runtime_host.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// A call report carries the value only up to a limit; above it, a description.
//
// The same cases as hkp-node's and hkp-frontend's call-report.test.ts and
// hkp-python's test_call_report.py.
// ──────────────────────────────────────────────────────────────────────────────

namespace {
constexpr uint64_t LIMIT = 100;
}

TEST_CASE("A value small enough is reported as it is", "[call-report]")
{
  const json value{{"a", json::array({1, "two", nullptr, true})}};
  REQUIRE(call_report::reported(Data(value), LIMIT) == value);
  REQUIRE(call_report::reported(Data(std::string("short")), LIMIT) == "short");
  REQUIRE(call_report::reported(Data(Null()), LIMIT).is_null());
  REQUIRE(call_report::reported(Data(Undefined()), LIMIT) == "<undefined>");
}

TEST_CASE("A text too large is described by its size in bytes and how it begins",
          "[call-report]")
{
  std::string text;
  for (int i = 0; i < 60; ++i)
    text += "é"; // 120 bytes
  REQUIRE(call_report::reported(Data(text), LIMIT) ==
          json{{"__hkpTooLarge", {{"type", "string"}, {"bytes", 120}, {"exact", true}, {"preview", text}}}});
}

TEST_CASE("A preview never ends inside a character", "[call-report]")
{
  // 'a' and then two-byte characters: the cut at an odd byte falls inside one.
  std::string text = "a";
  for (int i = 0; i < 1000; ++i)
    text += "é";
  REQUIRE(call_report::head(text, 4) == "aé");
}

TEST_CASE("JSON too large is counted only until it passes the limit, with how it begins",
          "[call-report]")
{
  json items = json::array();
  for (int i = 0; i < 50; ++i)
    items.push_back("item-" + std::to_string(i));

  const auto described = call_report::reported(Data(json{{"items", items}}), LIMIT)["__hkpTooLarge"];
  REQUIRE(described["type"] == "json");
  REQUIRE(described["exact"] == false);
  REQUIRE(described["bytes"].get<uint64_t>() > LIMIT);
  REQUIRE(described["preview"].get<std::string>().rfind(R"({"items":["item-0","item-1")", 0) == 0);
}

TEST_CASE("JSON too large is judged without visiting all of it", "[call-report]")
{
  // Built before the clock starts: putting it into a Data copies all of it.
  const Data huge = json(std::vector<int>(10'000'000, 1));
  const auto started = std::chrono::steady_clock::now();
  const auto described = call_report::reported(huge)["__hkpTooLarge"];
  const auto took = std::chrono::steady_clock::now() - started;

  REQUIRE(std::chrono::duration_cast<std::chrono::milliseconds>(took).count() < 200);
  REQUIRE(described["type"] == "json");
  REQUIRE(described["exact"] == false);
}

TEST_CASE("A preview is at most its length, ending in an ellipsis", "[call-report]")
{
  const auto described =
    call_report::reported(Data(json{{"text", std::string(5000, 'y')}}), LIMIT)["__hkpTooLarge"];
  REQUIRE(described["preview"] ==
          R"({"text":")" + std::string(call_report::previewLength - 9, 'y') + "…");
}

TEST_CASE("A description is told apart from a value", "[call-report]")
{
  REQUIRE(call_report::isTooLarge(json{{"__hkpTooLarge", {{"type", "json"}}}}));
  REQUIRE_FALSE(call_report::isTooLarge(json{{"tooLarge", true}}));
  REQUIRE_FALSE(call_report::isTooLarge(json::array({json{{"__hkpTooLarge", json::object()}}})));
}

TEST_CASE("A captured lifecycle report describes a value above the limit, and carries one at it",
          "[call-report]")
{
  const std::string above(call_report::limit + 1, 'z');
  const auto report = lifecycleNotification("call-process-finished", Data(above), true);
  REQUIRE(report["__internal"]["state"] == "call-process-finished");
  REQUIRE(report["__internal"]["data"]["__hkpTooLarge"]["bytes"] == call_report::limit + 1);

  const std::string at(call_report::limit, 'z');
  REQUIRE(lifecycleNotification("call-process", Data(at), true)["__internal"]["data"] == at);
}

TEST_CASE("A lifecycle report without Capture mode says only that the call happened",
          "[call-report][capture]")
{
  REQUIRE(lifecycleNotification("call-process", Data(json{{"secret", 1}}), false) ==
          json{{"__internal", {{"state", "call-process"}}}});
  REQUIRE(lifecycleNotification("call-process-finished", Data(json{{"secret", 1}}), false) ==
          json{{"__internal", {{"state", "call-process-finished"}}}});
  // And whether it passed nothing on, which is what a stopped pipeline is.
  REQUIRE(lifecycleNotification("call-process-finished", Data(Null()), false) ==
          json{{"__internal", {{"state", "call-process-finished"}, {"stopped", true}}}});
  REQUIRE(lifecycleNotification("call-process-finished", Data(Undefined()), false)["__internal"]["stopped"] == true);
}
