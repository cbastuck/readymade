#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_string.hpp>

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

// ──────────────────────────────────────────────────────────────────────────────
// What goes on the wire
//
// There are two transports — TLS and plain — and what a request carries is a
// property of the request rather than of the socket under it. Held apart, the
// two drifted: the plain path sent neither the configured headers nor the body,
// so the same board behaved differently depending on whether its URL began
// `https` or `http`. These pin the request itself, which is the thing both
// transports now share.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a configured header is put on the request", "[http-client]")
{
  HttpClient client("http-1");
  client.configure(nlohmann::json{{"headers", {{"authorization", "123"}}}});

  const auto req =
      client.buildRequest("get", "/hello", "", "127.0.0.1", 11, nlohmann::json::object());

  REQUIRE(req["authorization"] == "123");
  REQUIRE(req[boost::beast::http::field::host] == "127.0.0.1");
}

TEST_CASE("a configured body is put on the request", "[http-client]")
{
  HttpClient client("http-1");
  client.configure(nlohmann::json{{"body", "hello"}});

  const auto req =
      client.buildRequest("post", "/", "", "127.0.0.1", 11, nlohmann::json::object());

  REQUIRE(req.body() == "hello");
  REQUIRE(req.method() == boost::beast::http::verb::post);
}

TEST_CASE("the input may override what was configured", "[http-client]")
{
  HttpClient client("http-1");
  client.configure(nlohmann::json{{"headers", {{"authorization", "configured"}}}});

  const auto req = client.buildRequest(
      "get", "/", "", "127.0.0.1", 11,
      nlohmann::json{{"headers", {{"authorization", "from-input"}}}});

  REQUIRE(req["authorization"] == "from-input");
}

TEST_CASE("a header naming a secret nothing supplies is refused, not sent as itself",
          "[http-client][secrets]")
{
  // Sending the literal `{{secret.…}}` as a credential would fail far away with
  // an error naming nothing.
  HttpClient client("http-1");
  client.configure(
      nlohmann::json{{"headers", {{"authorization", "Bearer {{secret.api}}"}}}});

  REQUIRE_THROWS_WITH(
      client.buildRequest("get", "/", "", "127.0.0.1", 11, nlohmann::json::object()),
      Catch::Matchers::ContainsSubstring("no secrets available to resolve api"));
}

TEST_CASE("a method reads the same whichever case a board wrote it in",
          "[http-client]")
{
  // A board writes lower-case names; the wire uses upper-case ones. Reading the
  // same string both ways made the verb right and the body decision wrong.
  for (const auto& spelling : {"post", "POST", "Post"})
  {
    HttpClient client("http-1");
    client.configure(nlohmann::json{{"body", "hello"}, {"method", spelling}});

    const auto req = client.buildRequest(spelling, "/", "", "127.0.0.1", 11,
                                         nlohmann::json::object());

    REQUIRE(req.method() == boost::beast::http::verb::post);
    REQUIRE(req.body() == "hello");
  }
}

TEST_CASE("a configured method is the one the request uses", "[http-client]")
{
  // The board's method used to be stored and reported but never read, so every
  // request went out as the default GET — and a body, which is only attached to
  // a POST or a PUT, went nowhere with it.
  HttpClient client("http-1");
  client.configure(nlohmann::json{
      {"url", "http://127.0.0.1:8080/hosted/x"},
      {"method", "post"},
      {"body", "{\"hi\": \"world\"}"},
  });

  const auto state = client.getState();
  REQUIRE(state["method"] == "post");

  // The precedence that was wrong: the input decides, and what the board
  // configured is what a request with nothing to say about it uses.
  REQUIRE(chooseRequestMethod(nlohmann::json::object(), state["method"]) == "post");
  REQUIRE(chooseRequestMethod(nlohmann::json{{"method", "put"}}, state["method"]) == "put");
  REQUIRE(chooseRequestMethod(nlohmann::json::object(), "") == "get");

  const auto req = client.buildRequest(
      chooseRequestMethod(nlohmann::json::object(), state["method"]), "/", "",
      "127.0.0.1", 11, nlohmann::json::object());

  REQUIRE(req.method() == boost::beast::http::verb::post);
  REQUIRE(req.body() == "{\"hi\": \"world\"}");
}
