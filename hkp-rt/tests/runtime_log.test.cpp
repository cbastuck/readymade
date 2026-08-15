#include <catch2/catch_test_macros.hpp>

#include <string>

#include <log_entry.h>
#include <types/models.h>
#include <types/validation.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// What a runtime is willing to record, and what an entry looks like on the wire.
//
// `data` is the one free-form field in an entry and therefore the only place a
// service can put something it did not mean to keep. The board decides whether
// it is carried at all — a service cannot turn it on for itself — so the
// declaration travelling from the create payload into the runtime's
// configuration is what this covers.
//
// Driving a real pipeline and watching entries arrive needs a live runtime with
// a service in it; hkp-node/tests/board-log.test.ts and
// hkp-python/tests/test_board_log.py cover that half against the same contract.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

json createPayload(json extra = json::object()) {
  json payload = {
    {"id", "rt-1"},
    {"name", "Runtime"},
    {"services", json::array()},
  };
  payload.update(extra);
  return payload;
}

} // namespace

TEST_CASE("a board may refuse payloads whatever its services do",
          "[runtime][log]") {
  auto config = validateRuntime(
      createPayload({{"state", {{"logData", false}}}}));
  REQUIRE(config.has_value());
  REQUIRE_FALSE(config->logData);
}

TEST_CASE("saying nothing leaves the per-service choice as the gate",
          "[runtime][log]") {
  // The flow a runtime records never carries payloads, so what reaches a log is
  // only what a service was configured to put there.
  auto config = validateRuntime(createPayload());
  REQUIRE(config.has_value());
  REQUIRE(config->logData);

  auto empty = validateRuntime(createPayload({{"state", json::object()}}));
  REQUIRE(empty.has_value());
  REQUIRE(empty->logData);
}

TEST_CASE("only an unambiguous no closes the channel", "[runtime][log]") {
  auto fromString =
      validateRuntime(createPayload({{"state", {{"logData", "false"}}}}));
  REQUIRE(fromString.has_value());
  REQUIRE(fromString->logData);
}

TEST_CASE("a board picks how much it keeps", "[runtime][log]") {
  // The flow is recorded at debug, so this is what decides whether a board
  // keeps a trace of what ran or only what its services chose to say.
  auto config = validateRuntime(
      createPayload({{"state", {{"logging", true}, {"logLevel", "debug"}}}}));
  REQUIRE(config.has_value());
  REQUIRE(config->logLevel == "debug");
}

TEST_CASE("saying nothing keeps the flow out", "[runtime][log]") {
  auto config = validateRuntime(createPayload({{"state", {{"logging", true}}}}));
  REQUIRE(config.has_value());
  REQUIRE(config->logLevel == "info");

  auto nonsense = validateRuntime(
      createPayload({{"state", {{"logLevel", "chatty"}}}}));
  REQUIRE(nonsense.has_value());
  REQUIRE(nonsense->logLevel == "info");
}

TEST_CASE("levels order by severity", "[runtime][log]") {
  REQUIRE(levelRank(LogLevel::Debug) < levelRank(LogLevel::Info));
  REQUIRE(levelRank(LogLevel::Info) < levelRank(LogLevel::Warn));
  REQUIRE(levelRank(LogLevel::Warn) < levelRank(LogLevel::Error));
  REQUIRE(levelFromString("debug") == LogLevel::Debug);
  // Anything unrecognised is info rather than a surprise.
  REQUIRE(levelFromString("chatty") == LogLevel::Info);
}

TEST_CASE("an entry leaves out a duration it does not have", "[runtime][log]") {
  LogEntry entry;
  entry.runId = "run-1";
  entry.ts = "2026-08-15T10:00:00.000Z";
  entry.runtimeId = "rt-1";
  entry.serviceUuid = "svc-1";
  entry.event = "handled";
  REQUIRE_FALSE(entry.toJson().contains("durationMs"));

  entry.durationMs = 12.5;
  REQUIRE(entry.toJson()["durationMs"] == 12.5);
}

TEST_CASE("an entry names its run and what happened", "[runtime][log]") {
  LogEntry entry;
  entry.runId = "run-1";
  entry.ts = "2026-08-15T10:00:00.000Z";
  entry.runtimeId = "rt-1";
  entry.serviceUuid = "svc-1";
  entry.level = LogLevel::Warn;
  entry.event = "handled";

  const auto asJson = entry.toJson();
  REQUIRE(asJson["runId"] == "run-1");
  REQUIRE(asJson["runtimeId"] == "rt-1");
  REQUIRE(asJson["serviceUuid"] == "svc-1");
  REQUIRE(asJson["level"] == "warn");
  REQUIRE(asJson["event"] == "handled");
}

TEST_CASE("an entry leaves out what it does not carry", "[runtime][log]") {
  // Absence has to read as absence on the other side: a parentRunId that was
  // never set must not arrive as an empty string, which would look like a run
  // that descended from something unnamed rather than from nothing.
  LogEntry entry;
  entry.runId = "run-1";
  entry.ts = "2026-08-15T10:00:00.000Z";
  entry.runtimeId = "rt-1";
  entry.serviceUuid = "svc-1";
  entry.event = "handled";

  const auto asJson = entry.toJson();
  REQUIRE_FALSE(asJson.contains("parentRunId"));
  REQUIRE_FALSE(asJson.contains("data"));
}

TEST_CASE("a nested run says what it descended from", "[runtime][log]") {
  LogEntry entry;
  entry.runId = "child";
  entry.parentRunId = "parent";
  entry.ts = "2026-08-15T10:00:00.000Z";
  entry.runtimeId = "rt-1";
  entry.serviceUuid = "svc-1";
  entry.event = "handled";
  entry.data = json{{"kept", true}};

  const auto asJson = entry.toJson();
  REQUIRE(asJson["parentRunId"] == "parent");
  REQUIRE(asJson["data"]["kept"] == true);
}

TEST_CASE("a timestamp is UTC and sorts as text", "[runtime][log]") {
  // Entries are read back in file order and compared with `since`, so the
  // stamp has to be one that string comparison orders correctly.
  const auto stamp = isoTimestamp();
  REQUIRE(stamp.size() == 24);
  REQUIRE(stamp[4] == '-');
  REQUIRE(stamp[10] == 'T');
  REQUIRE(stamp.back() == 'Z');
}
