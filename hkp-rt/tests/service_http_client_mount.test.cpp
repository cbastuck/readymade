#include <catch2/catch_test_macros.hpp>

#include <string>

#include <types/data.h>

#include <mount.h>
#include <services/http_client.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Calling an endpoint whose address a runtime assigns.
//
// A board names the service that owns the endpoint; the board's coordinator
// resolves that to an address and configures this service with it. Until then
// the reference is still here, and the request must wait rather than go
// somewhere else. Mirrors hkp-node/tests/http-client.test.ts.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("mount references are told apart from addresses by scheme",
          "[mount]") {
  REQUIRE(isMountReference("hkp-mount://chat-node/peer-svc"));
  // An address is the other form of the same field, never a reference.
  REQUIRE_FALSE(isMountReference("http://127.0.0.1:8080/hosted/abc"));
  // A bare pair is indistinguishable from a relative URL, so it is not one.
  REQUIRE_FALSE(isMountReference("chat-node/peer-svc"));
  REQUIRE_FALSE(isMountReference(""));
}

TEST_CASE("a path is joined to a mount without doubling the separator",
          "[mount]") {
  REQUIRE(joinMountPath("http://h:8080/hosted/abc", "/x") == "http://h:8080/hosted/abc/x");
  REQUIRE(joinMountPath("http://h:8080/hosted/abc/", "/x") == "http://h:8080/hosted/abc/x");
  REQUIRE(joinMountPath("http://h:8080/hosted/abc", "x") == "http://h:8080/hosted/abc/x");
  REQUIRE(joinMountPath("http://h:8080/hosted/abc", "") == "http://h:8080/hosted/abc");
}

TEST_CASE("HttpClient waits while its mount is still a reference",
          "[services][http-client][mount]") {
  // Nothing is dialled: returning Null stops the pipeline until the coordinator
  // has handed over an address, which the next trigger then uses.
  HttpClient client("http-client-1");
  client.configure(json{{"__hkpMount", "hkp-mount://endpoint-node/echo-server"}});

  REQUIRE(isNull(client.process(json{{"triggerCount", 1}})));
}

TEST_CASE("HttpClient reports its mount and path in state",
          "[services][http-client][mount]") {
  HttpClient client("http-client-1");
  client.configure(json{
    {"__hkpMount", "hkp-mount://endpoint-node/echo-server"},
    {"path", "/hello"},
  });

  const auto state = client.getState();
  REQUIRE(state.value("__hkpMount", std::string{}) ==
          "hkp-mount://endpoint-node/echo-server");
  REQUIRE(state.value("path", std::string{}) == "/hello");
}
