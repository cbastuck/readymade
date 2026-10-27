#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <random>
#include <string>

#include "../sharedBoards.h"

using namespace readymade;
namespace fs = std::filesystem;

// ──────────────────────────────────────────────────────────────────────────────
// The boards the iOS app keeps in iCloud Drive, as the Mac reads and writes
// them. The same board has to be the same file on both, so names go through
// the one encoding both apps use (boardName.h, BoardLibrary.swift).
// ──────────────────────────────────────────────────────────────────────────────

namespace
{
struct Scratch
{
  fs::path root;

  Scratch()
  {
    std::random_device device;
    root = fs::temp_directory_path() / ("shared-boards-" + std::to_string(device()));
    fs::create_directories(root);
  }
  ~Scratch() { fs::remove_all(root); }

  void write(const std::string &fileName, const std::string &content) const
  {
    std::ofstream(root / fileName) << content;
  }
};
} // namespace

TEST_CASE("the folder is where iCloud Drive keeps the iOS app's container")
{
  REQUIRE(SharedBoards::iCloudFolder("/Users/someone") ==
          fs::path("/Users/someone/Library/Mobile Documents/iCloud~com~readymadeit~readymade/Documents/Boards"));
}

TEST_CASE("a folder that is not there has no boards and takes none")
{
  Scratch scratch;
  SharedBoards boards(scratch.root / "missing");
  REQUIRE_FALSE(boards.available());
  REQUIRE(boards.list().empty());
  REQUIRE_FALSE(boards.save("Idea", "{}"));
}

TEST_CASE("a board is the file the iOS app names it by")
{
  Scratch scratch;
  SharedBoards boards(scratch.root);

  REQUIRE(boards.save("Caf\xC3\xA9 / radio", R"({"boardName":"x"})"));
  REQUIRE(fs::exists(scratch.root / "Caf%C3%A9 %2F radio.hkpp"));
  REQUIRE(boards.load("Caf\xC3\xA9 / radio") == R"({"boardName":"x"})");

  const auto listed = boards.list();
  REQUIRE(listed.size() == 1);
  REQUIRE(listed[0].name == "Caf\xC3\xA9 / radio");
  REQUIRE_FALSE(listed[0].modified.empty());

  REQUIRE(boards.remove("Caf\xC3\xA9 / radio"));
  REQUIRE(boards.list().empty());
}

TEST_CASE("a board iCloud has not downloaded yet is listed; other files are not")
{
  Scratch scratch;
  scratch.write(".Morning radio.hkpp.icloud", "placeholder");
  scratch.write("Evening.hkpp", "{}");
  scratch.write(".DS_Store", "");
  scratch.write("notes.txt", "");
  SharedBoards boards(scratch.root);

  const auto listed = boards.list();
  REQUIRE(listed.size() == 2);
  REQUIRE(listed[0].name == "Evening");
  REQUIRE(listed[1].name == "Morning radio");
}

TEST_CASE("saving replaces a board whole and leaves nothing beside it")
{
  Scratch scratch;
  SharedBoards boards(scratch.root);
  REQUIRE(boards.save("Idea", "first"));
  REQUIRE(boards.save("Idea", "second"));
  REQUIRE(boards.load("Idea") == "second");
  REQUIRE(boards.list().size() == 1);
  REQUIRE_FALSE(fs::exists(scratch.root / "Idea.hkpp.saving"));
}

TEST_CASE("a name that is not a board name reaches no file")
{
  Scratch scratch;
  SharedBoards boards(scratch.root);
  REQUIRE_FALSE(boards.save("", "{}"));
  REQUIRE_FALSE(boards.save("tab\there", "{}"));
  REQUIRE_FALSE(boards.load("").has_value());
}
