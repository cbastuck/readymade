#include <catch2/catch_test_macros.hpp>

#include <types/data.h>
#include "services/http_server/http_server_subservices.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Starting and stopping an http-server-subservices.
//
// The service starts out bypassed and its destructor stops unconditionally, so
// "stop" is reached in states where the server is not running: never started at
// all, or stopped already by a bypass toggle. Both used to dereference the
// listener a previous stop had reset, which crashed the runtime as a board was
// loaded.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("destroying a server that never started is safe",
          "[http-server-subservices][lifecycle]") {
  // A service constructed from a board and torn down before anything unbypassed
  // it — the state every one of them is in for a moment.
  { HttpServerSubservices server("http-1"); }
  SUCCEED("destructor completed without dereferencing a missing listener");
}

TEST_CASE("destroying a server that was already stopped is safe",
          "[http-server-subservices][lifecycle]") {
  {
    HttpServerSubservices server("http-1");

    // Port 0 asks the OS for a free one, so tests never collide. Configured in
    // its own call, before unbypassing: configure() applies bypass before the
    // rest of the state, so asking to start in the same call would bind first
    // and then apply the requested port over the one it bound.
    server.configure(Data(json{
      {"port", 0},
      {"mode", "process_on_session"},
    }));
    server.configure(Data(json{{"bypass", false}}));
    REQUIRE(server.getState().value("port", 0) != 0);

    // Bypassing stops the server; leaving this scope stops it a second time.
    server.configure(Data(json{{"bypass", true}}));
  }
  SUCCEED("second stop completed without dereferencing a reset listener");
}
