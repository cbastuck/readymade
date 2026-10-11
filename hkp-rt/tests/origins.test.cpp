#include <catch2/catch_test_macros.hpp>

#include <origins.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Which pages may call a server, and when a request carrying no credential is
// let in for where it comes from. See origins.h.
//
// The same rows are pinned in every runtime server (hkp-node, hkp-python,
// hkp-rt): a board's runtimes must be equally closed to a foreign page
// whichever of them they run on.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

const std::vector<std::string> kNoNames;

bool admits(const AllowedOrigins& allowed, const std::string& origin,
            const std::string& secFetchSite = "", const std::string& host = "127.0.0.1:8887")
{
  return admitsWithoutCredential(RequestSource{origin, secFetchSite, host}, allowed, kNoNames);
}

}

TEST_CASE("a page served from this machine is a loopback origin, on any port",
          "[origins]") {
  REQUIRE(isLoopbackOrigin("http://localhost:5173"));
  REQUIRE(isLoopbackOrigin("http://localhost"));
  REQUIRE(isLoopbackOrigin("http://127.0.0.1:8555"));
  REQUIRE(isLoopbackOrigin("https://127.0.0.1:8443"));
  REQUIRE(isLoopbackOrigin("http://[::1]:3000"));
  REQUIRE(isLoopbackOrigin("HTTP://LOCALHOST:5173"));
}

TEST_CASE("a name that merely starts like a loopback one is somebody else's",
          "[origins]") {
  REQUIRE_FALSE(isLoopbackOrigin("http://localhost.evil.example"));
  REQUIRE_FALSE(isLoopbackOrigin("http://127.0.0.1.evil.example"));
  REQUIRE_FALSE(isLoopbackOrigin("http://127.evil.example"));
  REQUIRE_FALSE(isLoopbackOrigin("http://evil.example:8887"));
  REQUIRE_FALSE(isLoopbackOrigin("http://localhost:5173@evil.example"));
  REQUIRE_FALSE(isLoopbackOrigin("http://192.168.1.20:5173"));
  REQUIRE_FALSE(isLoopbackOrigin("file://localhost"));
  REQUIRE_FALSE(isLoopbackOrigin("null"));
  REQUIRE_FALSE(isLoopbackOrigin(""));
}

TEST_CASE("with nothing said, the apps and local pages may call, and no site may",
          "[origins]") {
  const auto allowed = AllowedOrigins::parse("");

  REQUIRE(admits(allowed, "saucer://embedded"));
  REQUIRE(admits(allowed, "hkp://app"));
  REQUIRE(admits(allowed, "https://appassets.androidplatform.net"));
  REQUIRE(admits(allowed, "http://localhost:5173"));

  REQUIRE_FALSE(admits(allowed, "https://evil.example"));
  // The project's own website is a site like any other until somebody says so.
  REQUIRE_FALSE(admits(allowed, "https://readymadeit.com"));
  // What a sandboxed frame, a file:// page and a data: URL all send.
  REQUIRE_FALSE(admits(allowed, "null"));
}

TEST_CASE("a caller that is not a browser says nothing and is let in",
          "[origins]") {
  REQUIRE(admits(AllowedOrigins::parse(""), ""));
  // No Host either: HTTP/1.0, or a client that left it off.
  REQUIRE(admits(AllowedOrigins::parse(""), "", "", ""));
}

TEST_CASE("a list names exactly who may call", "[origins]") {
  const auto allowed = AllowedOrigins::parse(" https://app.example , https://readymadeit.com ");

  REQUIRE(admits(allowed, "https://app.example"));
  REQUIRE(admits(allowed, "https://readymadeit.com"));
  REQUIRE(admits(allowed, "HTTPS://APP.EXAMPLE"));
  REQUIRE_FALSE(admits(allowed, "https://evil.example"));
  // Replaced, not extended: what was allowed unasked is not, once a list is given.
  REQUIRE_FALSE(admits(allowed, "http://localhost:5173"));
  REQUIRE_FALSE(admits(allowed, "saucer://embedded"));
}

TEST_CASE("a star lets any page call with a credential, and none without",
          "[origins]") {
  const auto allowed = AllowedOrigins::parse("*");

  REQUIRE(allowed.allows("https://evil.example"));
  REQUIRE_FALSE(allowed.allowsWithoutCredential("https://evil.example"));
  REQUIRE_FALSE(admits(allowed, "https://evil.example"));
  // What it reads as for such a request: nothing was said.
  REQUIRE(admits(allowed, "http://localhost:5173"));
  REQUIRE(admits(allowed, "saucer://embedded"));
}

TEST_CASE("what a host adds is allowed on top, and replaced by what it adds next",
          "[origins]") {
  auto allowed = AllowedOrigins::parse("");
  allowed.add({"http://192.168.1.5:9090", "https://readymadeit.com"});

  REQUIRE(admits(allowed, "http://192.168.1.5:9090"));
  REQUIRE(admits(allowed, "https://readymadeit.com"));
  REQUIRE(admits(allowed, "http://localhost:5173"));

  allowed.add({"http://192.168.1.5:9090"});
  REQUIRE_FALSE(admits(allowed, "https://readymadeit.com"));

  // A host cannot add "everybody".
  allowed.add({"*"});
  REQUIRE_FALSE(admits(allowed, "https://evil.example"));
}

TEST_CASE("a request without an origin is refused when the browser says it is cross-site",
          "[origins]") {
  const auto allowed = AllowedOrigins::parse("");

  REQUIRE_FALSE(admits(allowed, "", "cross-site"));
  REQUIRE_FALSE(admits(allowed, "", "Cross-Site"));
  // Typed into the address bar, or asked for by the server's own page.
  REQUIRE(admits(allowed, "", "none"));
  REQUIRE(admits(allowed, "", "same-origin"));
  // An allowed page is allowed however the browser classifies the request.
  REQUIRE(admits(allowed, "http://localhost:5173", "cross-site"));
}

TEST_CASE("a server is addressed by an address, localhost, or a name it was given",
          "[origins]") {
  REQUIRE(isKnownHost("127.0.0.1:8887", kNoNames));
  REQUIRE(isKnownHost("localhost:8887", kNoNames));
  REQUIRE(isKnownHost("localhost", kNoNames));
  REQUIRE(isKnownHost("192.168.1.5:8887", kNoNames));
  REQUIRE(isKnownHost("[::1]:8887", kNoNames));
  REQUIRE(isKnownHost("[fe80::1]", kNoNames));
  REQUIRE(isKnownHost("rt.example.com:5556", {"rt.example.com"}));
  REQUIRE(isKnownHost("RT.Example.com", {"rt.example.com"}));
}

TEST_CASE("a name somebody else resolves to this machine is not one it answers to",
          "[origins]") {
  // DNS rebinding: the page is same-origin with the server as far as the
  // browser can tell, so there is no Origin to refuse — only this.
  REQUIRE_FALSE(isKnownHost("attacker.example:8887", kNoNames));
  REQUIRE_FALSE(isKnownHost("127.0.0.1.attacker.example:8887", kNoNames));
  REQUIRE_FALSE(isKnownHost("localhost.attacker.example", kNoNames));
  REQUIRE_FALSE(isKnownHost("attacker.example", {"rt.example.com"}));
  REQUIRE_FALSE(isKnownHost("999.1.1.1", kNoNames));
  REQUIRE_FALSE(isKnownHost("1.2.3", kNoNames));
  REQUIRE_FALSE(isKnownHost("localhost:80@attacker.example", kNoNames));

  REQUIRE_FALSE(admits(AllowedOrigins::parse(""), "", "same-origin", "attacker.example:8887"));
  // An allowed page does not make up for it.
  REQUIRE_FALSE(admits(AllowedOrigins::parse(""), "http://localhost:5173", "", "attacker.example:8887"));
}
