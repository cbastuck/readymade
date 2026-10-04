#include <catch2/catch_test_macros.hpp>

#include <string>

#include "../boardName.h"

using namespace readymade;

// ──────────────────────────────────────────────────────────────────────────────
// What a board may be called, and the file name that stands for it.
//
// The two are pinned together because the first leans on the second: a name is
// accepted as a person wrote it only because no name, however written, can
// become more than one file name inside the boards directory.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a name is accepted as a person writes it")
{
  REQUIRE(isValidBoardName("Idea"));
  REQUIRE(isValidBoardName("my-board_2"));
  REQUIRE(isValidBoardName("Court Booking (Browser)"));
  REQUIRE(isValidBoardName("Voice Assistant + Skills"));
  REQUIRE(isValidBoardName("Live Radio (Cloud, direct)"));
  REQUIRE(isValidBoardName("folder/board"));
  REQUIRE(isValidBoardName("100% done."));
}

TEST_CASE("a name may be in any script")
{
  REQUIRE(isValidBoardName("Microphone \xE2\x86\x92 Speaker"));   // →
  REQUIRE(isValidBoardName("Offer Intake \xE2\x80\x94 Follow-up")); // —
  REQUIRE(isValidBoardName("Caf\xC3\xA9"));                         // é
  REQUIRE(isValidBoardName("\xF0\x9F\x8E\xBE Courts"));             // 🎾
}

TEST_CASE("an empty name is refused")
{
  REQUIRE_FALSE(isValidBoardName(""));
}

TEST_CASE("control characters are refused")
{
  REQUIRE_FALSE(isValidBoardName("two\nlines"));
  REQUIRE_FALSE(isValidBoardName("tab\there"));
  REQUIRE_FALSE(isValidBoardName(std::string("nul\0inside", 10)));
  REQUIRE_FALSE(isValidBoardName("delete\x7F"));
}

TEST_CASE("bytes that are not UTF-8 are refused")
{
  // The name is echoed back in JSON, which cannot carry them.
  REQUIRE_FALSE(isValidBoardName("\xFF"));
  REQUIRE_FALSE(isValidBoardName("stray \x80 continuation"));
  REQUIRE_FALSE(isValidBoardName("cut short \xE2\x86"));
  REQUIRE_FALSE(isValidBoardName("overlong \xC0\xAF"));
  REQUIRE_FALSE(isValidBoardName("surrogate \xED\xA0\x80"));
  REQUIRE_FALSE(isValidBoardName("beyond unicode \xF4\x90\x80\x80"));
}

TEST_CASE("plain names are stored under themselves")
{
  // Boards saved before the encoding mattered keep the file they have.
  REQUIRE(encodeBoardNameForStorage("Idea") == "Idea");
  REQUIRE(encodeBoardNameForStorage("my-board_2 final") == "my-board_2 final");
}

TEST_CASE("everything else in a name is escaped")
{
  REQUIRE(encodeBoardNameForStorage("Court Booking (Browser)") == "Court Booking %28Browser%29");
  REQUIRE(encodeBoardNameForStorage("folder/board") == "folder%2Fboard");
  REQUIRE(encodeBoardNameForStorage("100%") == "100%25");
}

TEST_CASE("no name leaves the directory it is stored in")
{
  for (const std::string name : {"..", "../../etc/passwd", "a/b", "a\\b", ".hidden", "C:\\boards\\x"})
  {
    const auto stored = encodeBoardNameForStorage(name);

    REQUIRE(stored.find('/') == std::string::npos);
    REQUIRE(stored.find('\\') == std::string::npos);
    REQUIRE(stored.find('.') == std::string::npos);
    REQUIRE(stored.find(':') == std::string::npos);
  }
}

TEST_CASE("a stored name reads back as the name it was given")
{
  for (const std::string name : {
         "Idea",
         "Court Booking (Browser)",
         "Voice Assistant + Skills",
         "Microphone \xE2\x86\x92 Speaker",
         "folder/board",
         "100% done.",
         "ends in a percent %",
         "looks encoded %28 already",
       })
  {
    REQUIRE(decodeBoardNameFromStorage(encodeBoardNameForStorage(name)) == name);
  }
}
