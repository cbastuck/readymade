#include <catch2/catch_test_macros.hpp>

#include "../redirectParams.h"

using namespace readymade;

TEST_CASE("a callback URL's query string becomes its parameters")
{
  const auto params =
    parseRedirectParams("http://127.0.0.1:9090/serviceRedirect?code=abc123&state=xyz");

  REQUIRE(params["code"] == "abc123");
  REQUIRE(params["state"] == "xyz");
}

TEST_CASE("percent-encoded values are decoded")
{
  // Auth0 sends error_description as prose, encoded: it is meant to be read.
  const auto params = parseRedirectParams(
    "http://127.0.0.1:9090/serviceRedirect?error=access_denied"
    "&error_description=User+did%20not%20authorize");

  REQUIRE(params["error"] == "access_denied");
  REQUIRE(params["error_description"] == "User did not authorize");
}

TEST_CASE("a hash fragment is read where one is in hand")
{
  // Only when the whole URL is available — a browser sends the server the
  // query string alone, which is why the served page posts the fragment back.
  const auto params =
    parseRedirectParams("http://127.0.0.1:9090/serviceRedirect#access_token=t0k&state=xyz");

  REQUIRE(params["access_token"] == "t0k");
  REQUIRE(params["state"] == "xyz");
}

TEST_CASE("a posted fragment parses on its own")
{
  const auto params = parseParamString("access_token=t0k&state=xyz");

  REQUIRE(params["access_token"] == "t0k");
  REQUIRE(params["state"] == "xyz");
}

TEST_CASE("a callback with no parameters yields nothing to relay")
{
  REQUIRE(parseRedirectParams("http://127.0.0.1:9090/serviceRedirect").empty());
  REQUIRE(parseParamString("").empty());
  // Nothing to key a waiting flow by, so nothing is relayed.
  REQUIRE(parseParamString("novalue").empty());
}

TEST_CASE("only this machine may deliver a callback")
{
  // The frontend server binds 0.0.0.0 to serve phones on the LAN; the
  // authorization code is not theirs to hand over.
  for (const auto* peer : {"127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"})
  {
    REQUIRE(isLoopbackPeer(peer));
  }
  for (const auto* peer : {"192.168.1.10", "10.0.0.4", "0.0.0.0", "::ffff:192.168.1.10", ""})
  {
    REQUIRE_FALSE(isLoopbackPeer(peer));
  }
}
