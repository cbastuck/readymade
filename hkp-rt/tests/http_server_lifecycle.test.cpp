#include <catch2/catch_test_macros.hpp>

#include <types/data.h>
#include "mount.h"
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

    // Port 0 asks the OS for a free one, so tests never collide.
    server.configure(Data(json{
      {"port", 0},
      {"mode", "process_on_session"},
      {"bypass", false},
    }));
    REQUIRE(server.getState().value("port", 0) != 0);

    // Bypassing stops the server; leaving this scope stops it a second time.
    server.configure(Data(json{{"bypass", true}}));
  }
  SUCCEED("second stop completed without dereferencing a reset listener");
}

// ──────────────────────────────────────────────────────────────────────────────
// Which request headers a pipeline is shown
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("every header reaches a pipeline that has not said otherwise",
          "[http-server][headers]")
{
  // A caller proving who it is does so in a header, so a pipeline that cannot
  // see them cannot check one.
  const std::map<std::string, std::string> carried{
      {"authorization", "123"}, {"x-signature", "abc"}};

  const auto shown = filterRequestHeaders(carried, std::nullopt);

  REQUIRE(shown["authorization"] == "123");
  REQUIRE(shown["x-signature"] == "abc");
}

TEST_CASE("a board that names headers receives only those",
          "[http-server][headers]")
{
  const std::map<std::string, std::string> carried{
      {"authorization", "123"}, {"x-signature", "abc"}};

  const auto shown = filterRequestHeaders(
      carried, std::vector<std::string>{"x-signature"});

  REQUIRE(shown.size() == 1);
  REQUIRE(shown["x-signature"] == "abc");
}

TEST_CASE("an empty list is a decision too, and forwards none",
          "[http-server][headers]")
{
  const std::map<std::string, std::string> carried{{"authorization", "123"}};

  REQUIRE(filterRequestHeaders(carried, std::vector<std::string>{}).empty());
}

TEST_CASE("the choice is reported, so a board saves it",
          "[http-server][headers]")
{
  HttpServerSubservices server("http-1");

  // Unset until a board says otherwise: everything is forwarded.
  REQUIRE(server.getState()["forwardHeaders"].is_null());

  server.configure(nlohmann::json{{"forwardHeaders", {"Authorization"}}});

  // Lower-cased on the way in, as HTTP header names compare.
  REQUIRE(server.getState()["forwardHeaders"] ==
          nlohmann::json::array({"authorization"}));
}

// ──────────────────────────────────────────────────────────────────────────────
// The port a board saved is the port it comes back on.
//
// A board is restored in a single configure() carrying the saved state — the
// port among it, and bypass:false alongside. Binding before that port is
// applied hands out an OS-assigned one instead, and the board advertises a
// different endpoint on every load: whoever was configured with the address by
// hand is pointed at nothing.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a saved port is bound again on reload",
          "[http-server-subservices][lifecycle][port]") {
  // What a board saves, produced the way a board produces it: started on port 0
  // once, and asked what port it got.
  int savedPort = 0;
  {
    HttpServerSubservices server("http-1");
    server.configure(Data(json{{"port", 0}, {"bypass", false}}));
    savedPort = server.getState().value("port", 0);
    REQUIRE(savedPort != 0);
  }

  // Reloading that board: one configure, holding the saved port and bypass
  // together.
  HttpServerSubservices reloaded("http-1");
  reloaded.configure(Data(json{{"port", savedPort}, {"bypass", false}}));

  const auto state = reloaded.getState();
  REQUIRE(state.value("port", 0) == savedPort);
  REQUIRE(state.value("status", std::string()) == "online");

  // The published address is what an outside caller was configured with, so it
  // has to name the same port rather than the one the state reports.
  REQUIRE(state.value(MOUNT_FIELD, std::string())
              .find(":" + std::to_string(savedPort) + "/") != std::string::npos);
}

TEST_CASE("port 0 is the only thing that draws a new port",
          "[http-server-subservices][lifecycle][port]") {
  HttpServerSubservices server("http-1");
  server.configure(Data(json{{"port", 0}, {"bypass", false}}));
  const auto first = server.getState().value("port", 0);

  // Restarting on the port it reports keeps it; the OS is only asked again when
  // the board still says 0.
  server.configure(Data(json{{"bypass", true}}));
  server.configure(Data(json{{"port", first}, {"bypass", false}}));
  REQUIRE(server.getState().value("port", 0) == first);
}

TEST_CASE("changing the port of a running server rebinds it",
          "[http-server-subservices][lifecycle][port]") {
  HttpServerSubservices server("http-1");
  server.configure(Data(json{{"port", 0}, {"bypass", false}}));
  const auto first = server.getState().value("port", 0);

  // A free port to move to, found the way the OS hands one out.
  int target = 0;
  {
    HttpServerSubservices scout("http-2");
    scout.configure(Data(json{{"port", 0}, {"bypass", false}}));
    target = scout.getState().value("port", 0);
  }
  REQUIRE(target != first);

  // A port is read when the acceptor binds. Changing it while the server runs
  // would otherwise leave the state advertising a port nothing listens on.
  server.configure(Data(json{{"port", target}}));

  const auto state = server.getState();
  REQUIRE(state.value("port", 0) == target);
  REQUIRE(state.value("status", std::string()) == "online");
  REQUIRE(state.value(MOUNT_FIELD, std::string())
              .find(":" + std::to_string(target) + "/") != std::string::npos);
}
