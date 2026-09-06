#include <catch2/catch_test_macros.hpp>

#include <secrets.h>

/**
 * What a runtime does with the values it was given.
 *
 * They arrive apart from every service's state and leave only through
 * resolve(), for one use, named destination first. The behaviour pinned here is
 * the same behaviour hkp-node and the browser pin: a board written against one
 * runtime has to open against another, which makes these the shared contract
 * rather than this runtime's own arrangement.
 */

using namespace hkp;

namespace
{
SecretVault vaultOf(const nlohmann::json& payload)
{
  SecretVault vault;
  vault.replace(readSecretsPayload(payload));
  return vault;
}
} // namespace

TEST_CASE("a value is substituted for the reference that names it", "[secrets]")
{
  auto vault = vaultOf({{"mail", {{"value", "hunter2"}}}});

  const auto resolved =
      vault.resolve(nlohmann::json{{"pass", "{{secret.mail}}"}},
                    "imap.example.com:993");

  REQUIRE(resolved.value["pass"] == "hunter2");
  REQUIRE(resolved.missing.empty());
  REQUIRE(resolved.refused.empty());
}

TEST_CASE("a reference resolves inside a larger string and anywhere nested",
          "[secrets]")
{
  auto vault = vaultOf({{"api", {{"value", "sk-1"}}}});

  const auto resolved = vault.resolve(
      nlohmann::json{{"headers", {{"Authorization", "Bearer {{secret.api}}"}}}},
      "https://api.example.com/v1");

  REQUIRE(resolved.value["headers"]["Authorization"] == "Bearer sk-1");
}

TEST_CASE("whitespace is tolerated and dots belong to the alias", "[secrets]")
{
  auto vault = vaultOf({{"gmail.imap", {{"value", "v"}}}});

  const auto resolved =
      vault.resolve(nlohmann::json("{{ secret.gmail.imap }}"), "imap.gmail.com");

  REQUIRE(resolved.value == "v");
}

TEST_CASE("an alias the runtime was not given resolves to nothing and is named",
          "[secrets]")
{
  auto vault = vaultOf(nlohmann::json::object());

  const auto resolved =
      vault.resolve(nlohmann::json{{"pass", "{{secret.absent}}"}}, "example.com");

  REQUIRE(resolved.value["pass"] == "");
  REQUIRE(resolved.missing == std::vector<std::string>{"absent"});
}

TEST_CASE("a value with no reference in it is left alone", "[secrets]")
{
  auto vault = vaultOf(nlohmann::json::object());

  REQUIRE(vault.resolve(nlohmann::json("literal"), "example.com").value ==
          "literal");
}

TEST_CASE("a secret goes to a host it is bound to", "[secrets][audience]")
{
  auto vault = vaultOf(
      {{"slack", {{"value", "xoxb"}, {"audience", {"hooks.slack.com"}}}}});

  const auto resolved = vault.resolve(nlohmann::json("{{secret.slack}}"),
                                      "https://hooks.slack.com/services/x");

  REQUIRE(resolved.value == "xoxb");
  REQUIRE(resolved.refused.empty());
}

TEST_CASE("and nowhere else, which it says by name", "[secrets][audience]")
{
  auto vault = vaultOf(
      {{"slack", {{"value", "xoxb"}, {"audience", {"hooks.slack.com"}}}}});

  const auto resolved =
      vault.resolve(nlohmann::json("{{secret.slack}}"), "https://evil.example/?p=1");

  REQUIRE(resolved.value == "");
  REQUIRE(resolved.refused.size() == 1);
  REQUIRE(resolved.refused[0].alias == "slack");
  REQUIRE(resolved.refused[0].to == "evil.example");
}

TEST_CASE("an entry with no audience may go anywhere", "[secrets][audience]")
{
  auto vault = vaultOf({{"any", {{"value", "v"}}}});

  REQUIRE(vault.resolve(nlohmann::json("{{secret.any}}"),
                        "https://anywhere.example")
              .value == "v");
}

TEST_CASE("a subdomain wildcard does not cover the bare domain",
          "[secrets][audience]")
{
  auto vault =
      vaultOf({{"k", {{"value", "v"}, {"audience", {"*.example.com"}}}}});

  REQUIRE(vault.resolve(nlohmann::json("{{secret.k}}"), "api.example.com").value ==
          "v");
  REQUIRE(vault.resolve(nlohmann::json("{{secret.k}}"), "example.com")
              .refused.size() == 1);
}

TEST_CASE("a host is read out of whatever shape a caller holds", "[secrets]")
{
  REQUIRE(destinationHost("https://api.example.com/v1?q=1") == "api.example.com");
  REQUIRE(destinationHost("imap.example.com:993") == "imap.example.com");
  REQUIRE(destinationHost("API.Example.COM") == "api.example.com");
  REQUIRE(destinationHost("  example.com  ") == "example.com");
  REQUIRE(destinationHost("") == "");
}

TEST_CASE("nothing is released without a destination to check it against",
          "[secrets]")
{
  auto vault = vaultOf({{"mail", {{"value", "hunter2"}}}});

  const auto resolved = vault.resolve(nlohmann::json("{{secret.mail}}"), "");

  REQUIRE(resolved.missing == std::vector<std::string>{"mail"});
}

TEST_CASE("the vault names what it holds and says nothing else about it",
          "[secrets]")
{
  auto vault = vaultOf({{"a", {{"value", "1"}}}, {"b", {{"value", "2"}}}});

  REQUIRE(vault.aliases() == std::vector<std::string>{"a", "b"});
}

TEST_CASE("a partial push leaves the rest in place", "[secrets]")
{
  auto vault = vaultOf({{"a", {{"value", "1"}}}, {"b", {{"value", "2"}}}});
  vault.merge(readSecretsPayload({{"b", {{"value", "changed"}}}}));

  REQUIRE(vault.resolve(nlohmann::json("{{secret.a}} {{secret.b}}"), "x.example")
              .value == "1 changed");
}

TEST_CASE("a payload may name a value directly or describe it", "[secrets]")
{
  const auto shortForm = readSecretsPayload({{"a", "v"}});
  REQUIRE(shortForm.at("a").value == "v");
  REQUIRE(shortForm.at("a").audience.empty());

  const auto longForm =
      readSecretsPayload({{"a", {{"value", "v"}, {"audience", {"h.example"}}}}});
  REQUIRE(longForm.at("a").audience == std::vector<std::string>{"h.example"});
}

TEST_CASE("what cannot be read is dropped rather than failing the request",
          "[secrets]")
{
  const auto entries = readSecretsPayload(
      {{"a", {{"audience", {"x"}}}}, {"b", 7}, {"c", nullptr}, {"d", "ok"}});

  REQUIRE(entries.size() == 1);
  REQUIRE(entries.count("d") == 1);
  REQUIRE(readSecretsPayload(nlohmann::json("nonsense")).empty());
}

TEST_CASE("a credential is a value to send or a reason there is none",
          "[secrets][credential]")
{
  auto vault = vaultOf({{"api", {{"value", "sk-1"}}}});

  SECTION("a literal passes through with no vault needed")
  {
    const auto out = resolveCredential(nullptr, nlohmann::json("Bearer literal"),
                                       "https://api.example.com");
    REQUIRE(out.problem.empty());
    REQUIRE(out.value == "Bearer literal");
  }

  SECTION("a reference with no vault behind it is never sent as its own text")
  {
    const auto out = resolveCredential(
        nullptr, nlohmann::json("Bearer {{secret.api}}"), "https://api.example.com");
    REQUIRE(out.value.is_null());
    REQUIRE(out.problem == "no secrets available to resolve api");
  }

  SECTION("a whole map resolves at once")
  {
    const auto out = resolveCredential(
        &vault,
        nlohmann::json{{"Authorization", "Bearer {{secret.api}}"},
                       {"Accept", "application/json"}},
        "https://api.example.com/v1");
    REQUIRE(out.problem.empty());
    REQUIRE(out.value["Authorization"] == "Bearer sk-1");
    REQUIRE(out.value["Accept"] == "application/json");
  }

  SECTION("and resolves to nothing at all when one entry may not go there")
  {
    auto bound = vaultOf(
        {{"api", {{"value", "sk-1"}, {"audience", {"api.example.com"}}}}});
    const auto out = resolveCredential(
        &bound,
        nlohmann::json{{"Authorization", "Bearer {{secret.api}}"},
                       {"Accept", "application/json"}},
        "https://evil.example/");
    // Not a half-filled map: a caller handed one might send it anyway.
    REQUIRE(out.value.is_null());
    REQUIRE(out.problem == "api may not be sent to evil.example");
  }
}
