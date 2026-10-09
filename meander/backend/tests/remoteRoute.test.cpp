#include <catch2/catch_test_macros.hpp>

#include "../remoteRoute.h"

using namespace readymade;

// ──────────────────────────────────────────────────────────────────────────────
// Which remote an hkp://remotes/<name>/… request may reach.
//
// Regression: the forward route captured `:remote` and never read it, so every
// name reached this app's embedded runtime. A board naming a runtime that was
// not running loaded and ran there instead — silently, since nothing failed and
// no port was in use. An unknown name must be refused so the board fails where
// the mistake is.
//
// This covers the rule, not its wiring: SchemeHandler::handleRemoteForward takes
// a saucer::scheme::request, a pimpl only the webview backend can construct, so
// the handler itself cannot be driven from a test. Keep the guard there a single
// call to isOwnRemote so the two cannot drift far.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a request naming this app's runtime is accepted", "[remotes]") {
  REQUIRE(isOwnRemote({{"remote", "meander-cpp"}}, "meander-cpp"));
}

TEST_CASE("a request naming any other runtime is refused", "[remotes]") {
  // The case that motivated the check: a board addressed at a hkp-node that was
  // not running must not be served by the embedded runtime instead.
  REQUIRE_FALSE(isOwnRemote({{"remote", "hkp-node"}}, "meander-cpp"));
  REQUIRE_FALSE(isOwnRemote({{"remote", "meander-android"}}, "meander-cpp"));
  REQUIRE_FALSE(isOwnRemote({{"remote", ""}}, "meander-cpp"));
}

TEST_CASE("matching is exact", "[remotes]") {
  // No prefix, suffix or case slack: a near-miss is someone's typo, and serving
  // it is the behaviour being fixed.
  REQUIRE_FALSE(isOwnRemote({{"remote", "meander-cpp-2"}}, "meander-cpp"));
  REQUIRE_FALSE(isOwnRemote({{"remote", "meander"}}, "meander-cpp"));
  REQUIRE_FALSE(isOwnRemote({{"remote", "Meander-CPP"}}, "meander-cpp"));
}

TEST_CASE("a request with no remote parameter is refused", "[remotes]") {
  // Cannot happen through the current route pattern, which always captures one,
  // but "no name given" is not a reason to serve the request.
  REQUIRE_FALSE(isOwnRemote({}, "meander-cpp"));
  REQUIRE_FALSE(isOwnRemote({{"other", "meander-cpp"}}, "meander-cpp"));
}

TEST_CASE("the requested remote is reported for the error body", "[remotes]") {
  // The 404 says which name was asked for, so a typo is visible rather than
  // silently routed somewhere else.
  REQUIRE(requestedRemote({{"remote", "hkp-node"}}) == "hkp-node");
  REQUIRE(requestedRemote({}).empty());
}

// ──────────────────────────────────────────────────────────────────────────────
// The name every app answers to for its own runtime.
//
// `meander-cpp` is this app's name for its runtime and no other app's, so a
// board that said it ran in one app only. `embedded` is the same everywhere:
// it is what the app lists its runtime as, and what a board says to mean the
// runtime of whichever app opened it.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a request naming the embedded runtime is accepted", "[remotes]") {
  REQUIRE(kEmbeddedRemoteName == "embedded");
  REQUIRE(isOwnRemote({{"remote", "embedded"}}, "meander-cpp"));
}

TEST_CASE("the name this app gave its runtime before is still answered to", "[remotes]") {
  // Boards saved before carry hkp://remotes/meander-cpp.
  REQUIRE(isOwnRemote({{"remote", "meander-cpp"}}, "meander-cpp"));
}

TEST_CASE("another app's name for its runtime is still not ours", "[remotes]") {
  REQUIRE_FALSE(isOwnRemote({{"remote", "meander-ios"}}, "meander-cpp"));
  REQUIRE_FALSE(isOwnRemote({{"remote", "Embedded"}}, "meander-cpp"));
}

TEST_CASE("neither of this runtime's names can be taken by a kept server", "[remotes]") {
  REQUIRE(isOwnRemoteName("embedded", "meander-cpp"));
  REQUIRE(isOwnRemoteName("meander-cpp", "meander-cpp"));
  REQUIRE_FALSE(isOwnRemoteName("Laptop", "meander-cpp"));
}
