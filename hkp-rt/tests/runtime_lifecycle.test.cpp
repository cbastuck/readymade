#include <catch2/catch_test_macros.hpp>

#include <string>

#include <types/models.h>
#include <types/validation.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// How long a runtime lives.
//
// Whoever creates a runtime says whether it should be cleaned up once the last
// client connected to it disconnects — they are the only ones who know. A
// browser running a board is its controller and asks for cleanup: its runtimes
// should not outlive the tab. A coordinator, a config file or a script says
// nothing and gets a runtime that lives until it is deleted.
//
// Cleanup is opted into rather than assumed, so nothing that exists today
// starts disappearing and a runtime is never reaped because of who happened to
// connect to it.
//
// This covers the declaration travelling from the create payload into the
// runtime's configuration. The reaping itself lives in the WebSocket close
// handler (Server::impl::reapIfAbandoned), which needs a live server and a real
// client — see hkp-node/tests/runtime-lifecycle.test.ts and
// hkp-python/tests/test_runtime_lifecycle.py for that half.
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

TEST_CASE("a runtime asks to be cleaned up", "[runtime][lifecycle]") {
  auto config = validateRuntime(createPayload({{"garbageCollected", true}}));
  REQUIRE(config.has_value());
  REQUIRE(config->garbageCollected);
}

TEST_CASE("saying nothing means the runtime persists", "[runtime][lifecycle]") {
  // A coordinator, a config file or a script never mentions it, and their
  // runtimes must outlive whoever happens to connect.
  auto config = validateRuntime(createPayload());
  REQUIRE(config.has_value());
  REQUIRE_FALSE(config->garbageCollected);
}

TEST_CASE("an explicit false means the same as saying nothing",
          "[runtime][lifecycle]") {
  auto config = validateRuntime(createPayload({{"garbageCollected", false}}));
  REQUIRE(config.has_value());
  REQUIRE_FALSE(config->garbageCollected);
}

TEST_CASE("a value that is not a boolean is not a request for cleanup",
          "[runtime][lifecycle]") {
  // Reaping a runtime is destructive, so it happens only on an unambiguous yes.
  auto fromString = validateRuntime(createPayload({{"garbageCollected", "true"}}));
  REQUIRE(fromString.has_value());
  REQUIRE_FALSE(fromString->garbageCollected);

  auto fromNumber = validateRuntime(createPayload({{"garbageCollected", 1}}));
  REQUIRE(fromNumber.has_value());
  REQUIRE_FALSE(fromNumber->garbageCollected);
}
