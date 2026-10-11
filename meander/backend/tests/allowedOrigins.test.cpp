#include <catch2/catch_test_macros.hpp>

#include "../allowedOrigins.h"

using namespace readymade;

// ──────────────────────────────────────────────────────────────────────────────
// The sites a person lets call this app's runtime from a browser.
//
// What the runtime compares against is the origin a browser states — scheme,
// host and port. What a person has is an address they copied. A list that kept
// the address would never match anything, silently: the site would stay
// refused with its name plainly in the settings.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("an address becomes the origin a browser would state for it", "[origins]") {
  REQUIRE(normalizeOrigin("https://readymadeit.com") == "https://readymadeit.com");
  REQUIRE(normalizeOrigin("https://readymadeit.com/") == "https://readymadeit.com");
  REQUIRE(normalizeOrigin("https://readymadeit.com/playground?board=x#top") ==
          "https://readymadeit.com");
  REQUIRE(normalizeOrigin("  HTTPS://ReadymadeIt.com  ") == "https://readymadeit.com");
  REQUIRE(normalizeOrigin("http://192.168.1.5:5173/app") == "http://192.168.1.5:5173");
}

TEST_CASE("what is not an address is not an origin", "[origins]") {
  REQUIRE(normalizeOrigin("").empty());
  REQUIRE(normalizeOrigin("   ").empty());
  REQUIRE(normalizeOrigin("readymadeit.com").empty());
  REQUIRE(normalizeOrigin("https://").empty());
  REQUIRE(normalizeOrigin("://readymadeit.com").empty());
  REQUIRE(normalizeOrigin("https://a.example, https://b.example").empty());
}

TEST_CASE("everybody cannot be allowed from the settings", "[origins]") {
  REQUIRE(normalizeOrigin("*").empty());
  REQUIRE(normalizeOrigin("https://*").empty());
  REQUIRE(normalizeOrigin("https://*.example.com").empty());
}

TEST_CASE("a list keeps each origin once and drops what is none", "[origins]") {
  const auto origins = normalizeOrigins({
    "https://readymadeit.com/playground",
    "not an address",
    "https://READYMADEIT.com",
    "https://app.example",
    "*",
  });

  REQUIRE(origins == std::vector<std::string>{"https://readymadeit.com", "https://app.example"});
}
