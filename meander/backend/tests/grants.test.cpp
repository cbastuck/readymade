#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <string>

#include "../grants.h"

// ──────────────────────────────────────────────────────────────────────────────
// The remembered answers to "send secrets to this runtime?".
//
// A grant is not a credential, but it is what stands between a board and one:
// anything that can add a line here can have a secret handed over without being
// asked. So it is written like the vault — owner-only — and it is merged rather
// than replaced, because a board that comes to need one more secret is asked
// about that one alone and the answer must not drop what was already agreed.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

/** Grants of their own, in a directory that does not outlive the test. */
class TempGrants
{
public:
  explicit TempGrants(const std::string& contents = "")
    : m_dir(std::filesystem::temp_directory_path() /
            ("readymade-grants-test-" + std::to_string(++s_counter)))
  {
    std::filesystem::create_directories(m_dir);
    if (!contents.empty())
    {
      std::ofstream file(path());
      file << contents;
    }
  }

  ~TempGrants()
  {
    std::error_code ec;
    std::filesystem::remove_all(m_dir, ec);
  }

  std::filesystem::path path() const { return m_dir / "grants.json"; }
  Grants open() const { return Grants(path()); }

private:
  std::filesystem::path m_dir;
  static inline int s_counter = 0;
};

const std::string MAIL_NODE = R"(["Mail","node","http://127.0.0.1:8080"])";
const std::string MAIL_OTHER = R"(["Mail","node","https://evil.example"])";

} // namespace

TEST_CASE("nothing is granted until something grants it", "[grants]") {
  TempGrants temp;
  Grants grants = temp.open();

  REQUIRE(grants.granted(MAIL_NODE).empty());
  REQUIRE(grants.getAll().empty());
}

TEST_CASE("what was granted is what comes back", "[grants]") {
  TempGrants temp;
  Grants grants = temp.open();

  REQUIRE(grants.grant(MAIL_NODE, {"gmail.imap"}));
  REQUIRE(grants.granted(MAIL_NODE) == std::vector<std::string>{"gmail.imap"});
}

TEST_CASE("a second grant adds to the first rather than replacing it", "[grants]") {
  // The case this guards: a board that comes to need `slack` is asked about
  // `slack` alone, so the answer carries only that — and must not be read as
  // withdrawing the secret already agreed to.
  TempGrants temp;
  Grants grants = temp.open();
  grants.grant(MAIL_NODE, {"gmail.imap"});

  REQUIRE(grants.grant(MAIL_NODE, {"slack"}));
  REQUIRE(grants.granted(MAIL_NODE) ==
          std::vector<std::string>{"gmail.imap", "slack"});
}

TEST_CASE("granting the same alias twice changes nothing", "[grants]") {
  TempGrants temp;
  Grants grants = temp.open();
  grants.grant(MAIL_NODE, {"gmail.imap"});
  grants.grant(MAIL_NODE, {"gmail.imap"});

  REQUIRE(grants.granted(MAIL_NODE) == std::vector<std::string>{"gmail.imap"});
}

TEST_CASE("a grant is bound to the address it was given for", "[grants]") {
  // A runtime id is board-controlled and means nothing alone: the same `node`
  // is repointed at another server by editing one field, and the grant must not
  // follow it there.
  TempGrants temp;
  Grants grants = temp.open();
  grants.grant(MAIL_NODE, {"gmail.imap"});

  REQUIRE(grants.granted(MAIL_OTHER).empty());
}

TEST_CASE("revoking one makes the next release ask again", "[grants]") {
  TempGrants temp;
  Grants grants = temp.open();
  grants.grant(MAIL_NODE, {"gmail.imap"});

  REQUIRE(grants.revoke(MAIL_NODE));
  REQUIRE(grants.granted(MAIL_NODE).empty());
}

TEST_CASE("revoking one that was never given is not a failure to report", "[grants]") {
  TempGrants temp;
  Grants grants = temp.open();

  REQUIRE_FALSE(grants.revoke(MAIL_NODE));
}

TEST_CASE("granting nothing grants nothing", "[grants]") {
  // A refusal reaches here as an empty list. Writing an empty entry would read
  // back as a key that exists, which is not the same as having agreed to it.
  TempGrants temp;
  Grants grants = temp.open();

  REQUIRE_FALSE(grants.grant(MAIL_NODE, {}));
  REQUIRE(grants.getAll().empty());
}

TEST_CASE("a key holding anything but names is ignored", "[grants]") {
  TempGrants temp(R"({"a":"not a list","b":[1,2],"c":["real"]})");
  Grants grants = temp.open();

  REQUIRE(grants.granted("a").empty());
  REQUIRE(grants.granted("b").empty());
  REQUIRE(grants.granted("c") == std::vector<std::string>{"real"});
  REQUIRE(grants.getAll().size() == 1);
}

TEST_CASE("a board named like a separator is still its own board", "[grants]") {
  // Why the key is a JSON array and not joined text: a board may be called
  // anything, and two different triples must never read as one.
  TempGrants temp;
  Grants grants = temp.open();
  grants.grant(R"(["Mail node","x","http://a"])", {"one"});
  grants.grant(R"(["Mail","node x","http://a"])", {"two"});

  REQUIRE(grants.granted(R"(["Mail node","x","http://a"])") ==
          std::vector<std::string>{"one"});
  REQUIRE(grants.granted(R"(["Mail","node x","http://a"])") ==
          std::vector<std::string>{"two"});
}

TEST_CASE("malformed json is no grants rather than a crash", "[grants]") {
  TempGrants temp("{not json at all");
  Grants grants = temp.open();

  REQUIRE(grants.getAll().empty());
  REQUIRE(grants.granted(MAIL_NODE).empty());
}

TEST_CASE("listing walks grants that outlive the call", "[grants]") {
  // The same dangling-temporary trap `vault.h` had: `items()` refers into the
  // json rather than copying it, so iterating one straight off a read walks a
  // container destroyed at the semicolon.
  TempGrants temp(R"({"a":["one"],"b":["two"],"c":["three"]})");
  Grants grants = temp.open();

  REQUIRE(grants.getAll().size() == 3);
}

TEST_CASE("the file is readable only by its owner", "[grants]") {
  TempGrants temp;
  Grants grants = temp.open();
  grants.grant(MAIL_NODE, {"gmail.imap"});

  const auto mode = std::filesystem::status(temp.path()).permissions();
  REQUIRE((mode & std::filesystem::perms::group_all) == std::filesystem::perms::none);
  REQUIRE((mode & std::filesystem::perms::others_all) == std::filesystem::perms::none);
}
