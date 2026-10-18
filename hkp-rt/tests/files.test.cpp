#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <string>

#include <files.h>

#include "files_fixture.h"

using namespace hkp;
namespace fs = std::filesystem;

// ──────────────────────────────────────────────────────────────────────────────
// Where a board may make this server read and write files (files.h).
//
// A path is reached only inside a folder the server was given, judged on what
// it is once `..` and symlinks are taken out — not on how it is spelled. A
// name that arrived as data stays inside the folder it was taken in.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("with no folders nothing is reached", "[files]") {
  files::setFolders({});
  std::string problem;
  REQUIRE_FALSE(files::resolve("/tmp/anything", problem));
  REQUIRE(problem.find("no folder") != std::string::npos);
  REQUIRE_FALSE(files::resolve("relative.txt", problem));
}

TEST_CASE("a relative path is taken from the default folder", "[files]") {
  FilesFixture fixture;
  std::string problem;
  auto path = files::resolve("recordings/take.wav", problem);
  REQUIRE(path);
  REQUIRE(path->path() == fixture.folder() / "recordings" / "take.wav");
}

TEST_CASE("an absolute path is reached inside any folder and refused outside all", "[files]") {
  FilesFixture fixture;
  const auto second = fixture.scratch() / "second";
  fs::create_directories(second);
  files::setFolders({fixture.folder(), second});

  std::string problem;
  REQUIRE(files::resolve((second / "a.txt").string(), problem));
  REQUIRE(files::resolve(fixture.folder().string(), problem)); // the folder itself, to list it
  REQUIRE_FALSE(files::resolve((fixture.scratch() / "outside.txt").string(), problem));
  REQUIRE(problem.find("outside") != std::string::npos);
  REQUIRE_FALSE(files::resolve("/etc/passwd", problem));
}

TEST_CASE("`..` does not lead out of a folder", "[files]") {
  FilesFixture fixture;
  std::string problem;
  REQUIRE_FALSE(files::resolve("../outside.txt", problem));
  REQUIRE_FALSE(files::resolve("a/../../outside.txt", problem));
  REQUIRE_FALSE(files::resolve((fixture.folder() / ".." / "outside.txt").string(), problem));
  // Staying inside is fine however it is spelled.
  REQUIRE(files::resolve("a/../b.txt", problem));
}

TEST_CASE("a symlink does not lead out of a folder", "[files]") {
  FilesFixture fixture;
  fixture.writeOutside("secret.txt", "secret");
  fs::create_directory_symlink(fixture.scratch(), fixture.folder() / "door");
  fs::create_symlink(fixture.scratch() / "secret.txt", fixture.folder() / "link.txt");

  std::string problem;
  REQUIRE_FALSE(files::resolve("door/secret.txt", problem));
  REQUIRE_FALSE(files::resolve("link.txt", problem));
}

TEST_CASE("a name from data stays inside the folder it is taken in", "[files]") {
  FilesFixture fixture;
  fs::create_directories(fixture.folder() / "inbox");
  fixture.write("other/kept.txt", "kept");
  std::string problem;
  auto inbox = files::resolve("inbox", problem);
  REQUIRE(inbox);

  auto plain = files::resolveIn(*inbox, "note.txt", problem);
  REQUIRE(plain);
  REQUIRE(plain->path() == fixture.folder() / "inbox" / "note.txt");

  // An absolute name is read as relative to the folder, not as a path.
  auto absolute = files::resolveIn(*inbox, "/etc/passwd", problem);
  REQUIRE(absolute);
  REQUIRE(absolute->path() == fixture.folder() / "inbox" / "etc" / "passwd");

  // Out of the folder, even into another part of the same default folder.
  REQUIRE_FALSE(files::resolveIn(*inbox, "../other/kept.txt", problem));
  REQUIRE_FALSE(files::resolveIn(*inbox, "../../outside.txt", problem));
}

TEST_CASE("folders are given only as absolute paths", "[files]") {
  FilesFixture fixture;
  files::setFolders({fs::path("relative/folder"), fixture.folder()});
  REQUIRE(files::folders().size() == 1);

  std::string error;
  auto listed = files::readFolderList("/srv/a : /srv/b", "HKP_FILES_ALLOW", error);
  REQUIRE(error.empty());
  REQUIRE(listed == std::vector<fs::path>{"/srv/a", "/srv/b"});
  REQUIRE(files::readFolderList("", "HKP_FILES_ALLOW", error).empty());
  REQUIRE(error.empty());

  REQUIRE(files::readFolderList("/srv/a:srv/b", "HKP_FILES_ALLOW", error).empty());
  REQUIRE(error == "HKP_FILES_ALLOW: \"srv/b\" is not an absolute path");
}

TEST_CASE("what is opened is what was resolved", "[files]") {
  FilesFixture fixture;
  std::string problem;
  auto path = files::resolve("note.txt", problem);
  REQUIRE(path);
  files::output(*path, std::ios::trunc) << "hello";
  REQUIRE(files::exists(*path));
  std::string read;
  files::input(*path) >> read;
  REQUIRE(read == "hello");

  auto folder = files::resolve(".", problem);
  REQUIRE(files::isFolder(*folder));
  REQUIRE(files::list(*folder) == std::vector<std::string>{"note.txt"});
}
