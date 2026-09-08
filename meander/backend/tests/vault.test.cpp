#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <string>

#include "../vault.h"

// ──────────────────────────────────────────────────────────────────────────────
// The store behind a board's `{{secret.<alias>}}` references.
//
// Two things are being pinned. One is the shape: an entry is a value and the
// hosts it may be sent to, and that audience is what stops a board from taking
// a credential somewhere it has never been — a constraint that is only worth
// having if it survives every other write to the file.
//
// The other is that entries written before audiences existed are bare strings.
// They have to keep resolving, and to become constrainable without losing the
// value, or the change costs whoever already had a vault their credentials.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

/** A vault of its own, in a directory that does not outlive the test. */
class TempVault
{
public:
  explicit TempVault(const std::string& contents = "")
    : m_dir(std::filesystem::temp_directory_path() /
            ("readymade-vault-test-" + std::to_string(++s_counter)))
  {
    std::filesystem::create_directories(m_dir);
    if (!contents.empty())
    {
      std::ofstream file(path());
      file << contents;
    }
  }

  ~TempVault()
  {
    std::error_code ec;
    std::filesystem::remove_all(m_dir, ec);
  }

  std::filesystem::path path() const { return m_dir / "vault.json"; }
  Vault open() const { return Vault(path()); }

private:
  std::filesystem::path m_dir;
  static inline int s_counter = 0;
};

} // namespace

TEST_CASE("a secret is stored with no audience until one is given", "[vault]") {
  TempVault temp;
  Vault vault = temp.open();

  REQUIRE(vault.setSecret("gmail", "hunter2"));
  REQUIRE(vault.getSecret("gmail") == "hunter2");
  // Unconstrained, which is what every entry answers until something records a
  // destination for it.
  REQUIRE(vault.audiences()["gmail"].empty());
}

TEST_CASE("an audience is set without touching the value", "[vault]") {
  TempVault temp;
  Vault vault = temp.open();
  vault.setSecret("gmail", "hunter2");

  REQUIRE(vault.setAudience("gmail", {"imap.gmail.com"}));
  REQUIRE(vault.getSecret("gmail") == "hunter2");
  REQUIRE(vault.audiences()["gmail"][0] == "imap.gmail.com");
}

TEST_CASE("replacing a value keeps the audience it was constrained to", "[vault]") {
  // The trap this guards: a rotated password that silently drops the
  // constraint would leave the secret free to go anywhere again, and nothing
  // about typing a new value says that is what was meant.
  TempVault temp;
  Vault vault = temp.open();
  vault.setSecret("gmail", "hunter2");
  vault.setAudience("gmail", {"imap.gmail.com"});

  REQUIRE(vault.setSecret("gmail", "hunter3"));
  REQUIRE(vault.getSecret("gmail") == "hunter3");
  REQUIRE(vault.audiences()["gmail"][0] == "imap.gmail.com");
}

TEST_CASE("there is nothing to constrain for an alias not held", "[vault]") {
  TempVault temp;
  Vault vault = temp.open();

  REQUIRE_FALSE(vault.setAudience("absent", {"example.com"}));
  REQUIRE(vault.aliases().empty());
}

TEST_CASE("a bare string is read as a value nothing constrains", "[vault]") {
  TempVault temp(R"({"legacy":"plain-value"})");
  Vault vault = temp.open();

  REQUIRE(vault.getSecret("legacy") == "plain-value");
  REQUIRE(vault.audiences()["legacy"].empty());
  REQUIRE(vault.aliases().size() == 1);
}

TEST_CASE("constraining a bare string rewrites it without losing the value", "[vault]") {
  TempVault temp(R"({"legacy":"plain-value"})");
  Vault vault = temp.open();

  REQUIRE(vault.setAudience("legacy", {"imap.example.com"}));
  REQUIRE(vault.getSecret("legacy") == "plain-value");
  REQUIRE(vault.audiences()["legacy"][0] == "imap.example.com");
}

TEST_CASE("what is injected into a page is one shape whatever is on disk", "[vault]") {
  TempVault temp(
    R"({"legacy":"plain","modern":{"value":"v","audience":["a.example"]}})");
  Vault vault = temp.open();

  const auto all = vault.getAll();
  REQUIRE(all["legacy"]["value"] == "plain");
  REQUIRE(all["legacy"]["audience"].empty());
  REQUIRE(all["modern"]["value"] == "v");
  REQUIRE(all["modern"]["audience"][0] == "a.example");
}

TEST_CASE("entries that are neither a value nor an entry are ignored", "[vault]") {
  TempVault temp(R"({"junk":42,"list":[1,2],"good":"value"})");
  Vault vault = temp.open();

  REQUIRE(vault.aliases().size() == 1);
  REQUIRE(vault.aliases()[0] == "good");
  REQUIRE(vault.getSecret("junk").empty());
}

TEST_CASE("a missing or unreadable file is an empty vault, not a failure", "[vault]") {
  TempVault temp;
  Vault vault = temp.open();

  REQUIRE(vault.aliases().empty());
  REQUIRE(vault.getSecret("anything").empty());
  REQUIRE_FALSE(vault.deleteSecret("anything"));
}

TEST_CASE("malformed json is an empty vault rather than a crash", "[vault]") {
  TempVault temp("{not json at all");
  Vault vault = temp.open();

  REQUIRE(vault.aliases().empty());
  REQUIRE(vault.getAll().empty());
}

TEST_CASE("listing walks a vault that outlives the call", "[vault]") {
  // Regression: these three read the file into a temporary and iterated it with
  // `items()`, which refers into the json rather than copying it. The container
  // was destroyed before the first entry was read — undefined behaviour that
  // read whatever was left, and crashed once entries got large enough.
  TempVault temp(
    R"({"one":"a","two":{"value":"b","audience":["h.example"]},"three":"c"})");
  Vault vault = temp.open();

  REQUIRE(vault.aliases().size() == 3);
  REQUIRE(vault.audiences().size() == 3);
  REQUIRE(vault.getAll().size() == 3);
}

TEST_CASE("the file is readable only by its owner", "[vault]") {
  // The whole of the protection: the contents are credentials and the file is
  // not encrypted.
  TempVault temp;
  Vault vault = temp.open();
  vault.setSecret("gmail", "hunter2");

  const auto mode = std::filesystem::status(temp.path()).permissions();
  REQUIRE((mode & std::filesystem::perms::group_all) == std::filesystem::perms::none);
  REQUIRE((mode & std::filesystem::perms::others_all) == std::filesystem::perms::none);
}
