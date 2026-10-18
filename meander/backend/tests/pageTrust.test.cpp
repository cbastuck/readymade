#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <random>

#include "../pageTrust.h"

using namespace readymade;
namespace fs = std::filesystem;

// ──────────────────────────────────────────────────────────────────────────────
// Which documents the webview trusts, and what it lets them do.
//
// The host exposes the vault, files and devices to whatever the webview holds,
// and cannot tell which frame is calling. So what loads is the boundary: the
// app's own pages, nothing else, at any depth.
// ──────────────────────────────────────────────────────────────────────────────

namespace
{
const std::vector<std::string> OWN = {
  "saucer://embedded",
  "http://localhost:8555",
  "http://192.168.1.5:9090",
};

Navigation navigate(const std::string& url,
                    bool newWindow = false,
                    bool userInitiated = false,
                    bool redirect = false)
{
  return decideNavigation(OWN, url, newWindow, userInitiated, redirect);
}

/** A folder of its own under the system's temporary one, removed after. */
struct Scratch
{
  fs::path root = fs::temp_directory_path() /
                  ("pageTrust-" + std::to_string(std::random_device{}()));
  Scratch() { fs::create_directories(root); }
  ~Scratch() { fs::remove_all(root); }
  fs::path file(const std::string& relative) const
  {
    auto path = root / relative;
    fs::create_directories(path.parent_path());
    std::ofstream{path} << "{}";
    return path;
  }
};
} // namespace

TEST_CASE("an origin is scheme, host and port, lowercased", "[pageTrust]") {
  REQUIRE(originOf("saucer://embedded/index.html") == "saucer://embedded");
  REQUIRE(originOf("HTTP://LocalHost:8555/playground?x=1#y") == "http://localhost:8555");
  REQUIRE(originOf("blob:saucer://embedded/3f2a") == "saucer://embedded");
  REQUIRE(originOf("about:blank").empty());
  REQUIRE(originOf("data:text/html,<script>1</script>").empty());
  REQUIRE(originOf("saucer://embedded@evil.example/").empty());
}

TEST_CASE("the app's own pages load, in any frame", "[pageTrust]") {
  REQUIRE(navigate("saucer://embedded/index.html") == Navigation::load);
  REQUIRE(navigate("http://localhost:8555/board/x") == Navigation::load);
  REQUIRE(navigate("http://192.168.1.5:9090/") == Navigation::load);
  REQUIRE(navigate("blob:saucer://embedded/3f2a") == Navigation::load);
  REQUIRE(navigate("about:blank") == Navigation::load);
  REQUIRE(navigate("about:srcdoc") == Navigation::load);
}

TEST_CASE("nothing else loads", "[pageTrust]") {
  for (const auto* url : {
         "https://evil.example/",
         "http://localhost:8556/",
         "http://localhost/",
         "https://localhost:8555/",
         "http://localhost:8555.evil.example/",
         "saucer://embedded.evil/",
         "saucer://embedded@evil.example/",
         "data:text/html,<script>1</script>",
         "blob:https://evil.example/3f2a",
         "file:///etc/passwd",
         "hkp://history/x",
         "javascript:alert(1)",
         "about:config",
       })
  {
    INFO(url);
    REQUIRE(navigate(url) == Navigation::block);
  }
}

TEST_CASE("a web address the person asked for opens in their browser", "[pageTrust]") {
  REQUIRE(navigate("https://example.com/", false, true) == Navigation::openInBrowser);
  REQUIRE(navigate("https://example.com/", true, true) == Navigation::openInBrowser);
  // As before: a new window opens there whoever asked for it.
  REQUIRE(navigate("https://example.com/", true, false) == Navigation::openInBrowser);
}

TEST_CASE("a page cannot send the person to their browser on its own", "[pageTrust]") {
  REQUIRE(navigate("https://example.com/") == Navigation::block);
  REQUIRE(navigate("https://example.com/", false, true, true) == Navigation::block);
  REQUIRE(navigate("file:///etc/passwd", false, true) == Navigation::block);
  REQUIRE(navigate("file:///etc/passwd", true, true) == Navigation::block);
  REQUIRE(navigate("hkp://history/x", true, true) == Navigation::block);
}

TEST_CASE("a device goes only to an own page, and only one boards use", "[pageTrust]") {
  const auto page = "saucer://embedded/index.html";
  REQUIRE(mayGrantPermission(OWN, page, {.microphone = true}));
  REQUIRE(mayGrantPermission(OWN, page, {.microphone = true, .camera = true}));
  REQUIRE(mayGrantPermission(OWN, page, {.location = true}));

  REQUIRE_FALSE(mayGrantPermission(OWN, page, {}));
  REQUIRE_FALSE(mayGrantPermission(OWN, page, {.other = true}));
  REQUIRE_FALSE(mayGrantPermission(OWN, page, {.camera = true, .other = true}));
  REQUIRE_FALSE(mayGrantPermission(OWN, "https://evil.example/", {.microphone = true}));
  REQUIRE_FALSE(mayGrantPermission(OWN, "about:blank", {.camera = true}));
}

TEST_CASE("nothing is readable or writable before something is picked", "[pageTrust]") {
  Scratch scratch;
  const FileGrants grants;
  REQUIRE_FALSE(grants.mayRead(scratch.file("board.hkpp")));
  REQUIRE_FALSE(grants.mayWrite(scratch.file("board.hkpp")));
}

TEST_CASE("a picked file opens its folder for reading, and only that", "[pageTrust]") {
  Scratch scratch;
  FileGrants grants;
  const auto board = scratch.file("boards/composition.hkpp");
  grants.grantFile(board);

  REQUIRE(grants.mayRead(board));
  REQUIRE(grants.mayRead(scratch.file("boards/unit.hkpp")));
  REQUIRE(grants.mayRead(scratch.file("boards/units/deeper/unit.hkpp")));
  // A unit not yet there is still inside; reading it fails on its own.
  REQUIRE(grants.mayRead(scratch.root / "boards" / "missing.hkpp"));

  // A sibling folder is where it stops.
  REQUIRE_FALSE(grants.mayRead(scratch.file("shared/unit.hkpp")));
  REQUIRE_FALSE(grants.mayRead(scratch.root / "boards" / ".." / "shared" / "unit.hkpp"));
  REQUIRE_FALSE(grants.mayRead(scratch.file("boards-other/unit.hkpp")));
  REQUIRE_FALSE(grants.mayRead("/etc/passwd"));
  REQUIRE_FALSE(grants.mayRead(""));
  // Opening is not saving.
  REQUIRE_FALSE(grants.mayWrite(board));
}

TEST_CASE("a symlink does not lead out of a granted folder", "[pageTrust]") {
  Scratch scratch;
  FileGrants grants;
  const auto outside = scratch.file("secret/id_rsa");
  const auto board = scratch.file("boards/composition.hkpp");
  std::error_code error;
  fs::create_symlink(outside, scratch.root / "boards" / "link", error);
  if (error)
  {
    SKIP("symlinks not available here: " << error.message());
  }
  grants.grantFile(board);

  REQUIRE_FALSE(grants.mayRead(scratch.root / "boards" / "link"));
}

TEST_CASE("a picked folder is readable at any depth", "[pageTrust]") {
  Scratch scratch;
  FileGrants grants;
  grants.grantFolder(scratch.root / "library");
  REQUIRE(grants.mayRead(scratch.file("library/a/b/unit.hkpp")));
  REQUIRE_FALSE(grants.mayRead(scratch.file("elsewhere.hkpp")));
  REQUIRE_FALSE(grants.mayWrite(scratch.file("library/a.hkpp")));
}

TEST_CASE("a save pick is the one path that may be written", "[pageTrust]") {
  Scratch scratch;
  FileGrants grants;
  const auto target = scratch.root / "out" / "runtime.json";
  grants.grantSave(target);

  REQUIRE(grants.mayWrite(target));
  REQUIRE(grants.mayWrite(scratch.root / "out" / "." / "runtime.json"));
  REQUIRE_FALSE(grants.mayWrite(scratch.root / "out" / "other.json"));
  REQUIRE_FALSE(grants.mayWrite(scratch.root / "out"));
  REQUIRE_FALSE(grants.mayRead(scratch.root / "out" / "other.json"));
}
