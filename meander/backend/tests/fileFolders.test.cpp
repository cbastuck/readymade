#include <catch2/catch_test_macros.hpp>

#include <random>

#include "../fileFolders.h"

using namespace readymade;

// ──────────────────────────────────────────────────────────────────────────────
// The folders a person lets boards read and write on the embedded runtime.
//
// They arrive from a folder picker, as a path or a file:// URL, and are kept
// as paths. A folder holding the app's own data — ~/.hkp, where the vault and
// the settings are, or the home folder around it — is never kept: a board
// that could write there could undo every other setting.
// ──────────────────────────────────────────────────────────────────────────────

namespace {
const std::filesystem::path kAppData = "/Users/me/.hkp";
}

TEST_CASE("a picked folder is kept as a path, once", "[fileFolders]") {
  REQUIRE(normalizeFileFolders({"/Users/me/Music"}, kAppData) == std::vector<std::string>{"/Users/me/Music"});
  REQUIRE(normalizeFileFolders({"file:///Users/me/My%20Samples/"}, kAppData) ==
          std::vector<std::string>{"/Users/me/My Samples"});
  REQUIRE(normalizeFileFolders({"/Users/me/Music/", "/Users/me/Music", " /Users/me/a/../Music "}, kAppData) ==
          std::vector<std::string>{"/Users/me/Music"});
}

TEST_CASE("what is not an absolute folder is dropped", "[fileFolders]") {
  REQUIRE(normalizeFileFolders({"", "   ", "Music", "./Music"}, kAppData).empty());
}

TEST_CASE("no folder holding the app's own data is kept", "[fileFolders]") {
  REQUIRE(normalizeFileFolders({"/Users/me/.hkp"}, kAppData).empty());
  REQUIRE(normalizeFileFolders({"/Users/me/.hkp/presets"}, kAppData).empty());
  REQUIRE(normalizeFileFolders({"/Users/me"}, kAppData).empty());
  REQUIRE(normalizeFileFolders({"/"}, kAppData).empty());
  REQUIRE(normalizeFileFolders({"/Users/me/Music/../.hkp"}, kAppData).empty());
  // Beside it is fine.
  REQUIRE(normalizeFileFolders({"/Users/me/.hkpx"}, kAppData) == std::vector<std::string>{"/Users/me/.hkpx"});
}

#ifndef _WIN32 // creating a symlink there takes a privilege tests do not have
TEST_CASE("no folder that reaches the app's own data on disk is kept", "[fileFolders]") {
  // The runtime follows a folder's symlinks before comparing a board's path
  // with it, so a folder that is only spelled differently is the same folder.
  namespace fs = std::filesystem;
  const auto scratch = fs::temp_directory_path() / ("hkp-file-folders-" + std::to_string(std::random_device{}()));
  fs::remove_all(scratch);
  const auto home = scratch / "home";
  const auto appData = home / ".hkp";
  fs::create_directories(appData / "cpp");
  fs::create_directories(home / "Music");
  fs::create_symlink(home, scratch / "to-home");
  fs::create_symlink(appData / "cpp", scratch / "to-cpp");

  // A symlink to the folder around the app's data, and one into it.
  REQUIRE(normalizeFileFolders({(scratch / "to-home").string()}, appData).empty());
  REQUIRE(normalizeFileFolders({(scratch / "to-cpp").string()}, appData).empty());
  REQUIRE(normalizeFileFolders({(scratch / "to-cpp" / "files").string()}, appData).empty());
  // A folder beside it, reached through the same symlink, is fine.
  REQUIRE(normalizeFileFolders({(scratch / "to-home" / "Music").string()}, appData) ==
          std::vector<std::string>{(scratch / "to-home" / "Music").string()});

  fs::remove_all(scratch);
}
#endif
