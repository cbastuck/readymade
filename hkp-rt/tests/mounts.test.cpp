#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <filesystem>
#include <string>

#ifndef _WIN32
#include <sys/stat.h>
#endif

#include <mounts.h>
#include <http/front_door.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Endpoints served on the runtime server's own port.
//
// The address of a mount is derived, so that it survives a restart, and the
// derivation is shared with hkp-node. Whose connection an arriving one is gets
// decided from its first request's head; what follows is about those two
// decisions. hkp-node/tests/coordinator-rt.test.ts calls a mounted endpoint on
// a running server.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a mount's address is the one hkp-node derives for the same mount",
          "[mounts]") {
  // createHmac("sha256", "test-secret")
  //   .update(["", "doorbell", "rt", "hook"].join("\0")).digest("hex").slice(0, 32)
  REQUIRE(deriveMountId("test-secret", "", "doorbell", "rt", "hook") ==
          "e9c6788f3d7e92a4077aa4579d0995c1");
}

TEST_CASE("each part of what a mount is changes its address", "[mounts]") {
  const auto id = deriveMountId("s", "", "board", "rt", "hook");

  REQUIRE(id.size() == 32);
  REQUIRE(deriveMountId("s", "", "board", "rt", "hook") == id);
  REQUIRE(deriveMountId("other", "", "board", "rt", "hook") != id);
  REQUIRE(deriveMountId("s", "", "other", "rt", "hook") != id);
  REQUIRE(deriveMountId("s", "", "board", "other", "hook") != id);
  REQUIRE(deriveMountId("s", "", "board", "rt", "other") != id);
  // The parts are kept apart: moving a character across a boundary is another
  // mount.
  REQUIRE(deriveMountId("s", "", "boardr", "t", "hook") != id);
}

TEST_CASE("a secret is drawn once and found again", "[mounts]") {
  namespace fs = std::filesystem;
  const auto dir = fs::temp_directory_path() /
    ("hkp-mounts-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
  const auto file = (dir / "mount-secret").string();

  const auto first = loadOrCreateMountSecret(file);
  const auto second = loadOrCreateMountSecret(file);

  REQUIRE(first.size() == 64);
  REQUIRE(second == first);
#ifndef _WIN32
  struct stat info;
  REQUIRE(::stat(file.c_str(), &info) == 0);
  REQUIRE((info.st_mode & 0777) == 0600);
#endif
  fs::remove_all(dir);
}

TEST_CASE("a request for a mount names it", "[mounts][front-door]") {
  const auto head = front_door::readHead(
    "POST /hosted/abc123/hello?x=1 HTTP/1.1\r\nHost: h\r\n\r\n");

  REQUIRE(head.valid);
  REQUIRE(head.method == "POST");
  REQUIRE(head.mountId == "abc123");
}

TEST_CASE("the mount's service is given the request without the mount's prefix",
          "[mounts][front-door]") {
  const std::string bytes =
    "POST /hosted/abc123/hello?x=1 HTTP/1.1\r\nHost: h\r\nContent-Length: 2\r\n\r\nhi";

  const auto given = front_door::forMount(bytes, front_door::readHead(bytes));

  REQUIRE(given ==
    "POST /hello?x=1 HTTP/1.1\r\nHost: h\r\nContent-Length: 2\r\n\r\nhi");
}

TEST_CASE("a request for the mount itself is a request for its root",
          "[mounts][front-door]") {
  for (const std::string target : {"/hosted/abc123", "/hosted/abc123?x=1"})
  {
    const std::string bytes = "GET " + target + " HTTP/1.1\r\n\r\n";
    const auto given = front_door::forMount(bytes, front_door::readHead(bytes));
    REQUIRE(given.rfind("GET /", 0) == 0);
    REQUIRE(given.find("/hosted") == std::string::npos);
  }
}

TEST_CASE("anything else is the api's", "[mounts][front-door]") {
  REQUIRE(front_door::readHead("GET /runtimes HTTP/1.1\r\n\r\n").mountId.empty());
  // Only the prefix itself, not a path that happens to start with the word.
  REQUIRE(front_door::readHead("GET /hostedness HTTP/1.1\r\n\r\n").mountId.empty());
  REQUIRE_FALSE(front_door::readHead("nonsense").valid);
}

TEST_CASE("the api is told who called, and nobody else can say so",
          "[mounts][front-door]") {
  const std::string bytes =
    "GET /runtimes HTTP/1.1\r\n"
    "Host: h\r\n"
    "x-hkp-front: guessed\r\n"
    "X-Hkp-Client: 127.0.0.1\r\n"
    "Connection: keep-alive\r\n"
    "Authorization: Bearer t\r\n"
    "\r\nbody";

  const auto passed = front_door::forApi(bytes, "the-secret", "203.0.113.9");

  // What the caller claimed about itself is gone; what this process says is
  // there once.
  REQUIRE(passed.find("guessed") == std::string::npos);
  REQUIRE(passed.find("X-Hkp-Client: 127.0.0.1") == std::string::npos);
  REQUIRE(passed.find("X-Hkp-Front: the-secret\r\n") != std::string::npos);
  REQUIRE(passed.find("X-Hkp-Client: 203.0.113.9\r\n") != std::string::npos);
  // One request per connection: who a connection belongs to is decided once.
  REQUIRE(passed.find("keep-alive") == std::string::npos);
  REQUIRE(passed.find("Connection: close\r\n") != std::string::npos);
  // The rest is as it came, body included.
  REQUIRE(passed.rfind("GET /runtimes HTTP/1.1\r\n", 0) == 0);
  REQUIRE(passed.find("Authorization: Bearer t\r\n") != std::string::npos);
  REQUIRE(passed.substr(passed.size() - 8) == "\r\n\r\nbody");
}

TEST_CASE("an upgrade is passed through as one", "[mounts][front-door]") {
  const std::string bytes =
    "GET /notifications HTTP/1.1\r\n"
    "Connection: Upgrade\r\n"
    "Upgrade: websocket\r\n"
    "\r\n";

  const auto passed = front_door::forApi(bytes, "s", "127.0.0.1");

  REQUIRE(passed.find("Connection: Upgrade\r\n") != std::string::npos);
  REQUIRE(passed.find("Connection: close") == std::string::npos);
  REQUIRE(passed.find("Upgrade: websocket\r\n") != std::string::npos);
}
