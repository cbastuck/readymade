#include <catch2/catch_test_macros.hpp>

#include <map>
#include <string>

#include <standalone_config.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// What a standalone hkp-rt is started with.
//
// On a person's own machine nothing needs saying. Anywhere else the bind has
// to be opened — and that is only allowed together with who may use the
// server. An exposed server with no allow-list is refused at start, not left
// to deny every request once it is running.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

EnvironmentReader environment(std::map<std::string, std::string> values)
{
  auto held = std::make_shared<std::map<std::string, std::string>>(std::move(values));
  return [held](const char* name) -> const char* {
    const auto it = held->find(name);
    return it == held->end() ? nullptr : it->second.c_str();
  };
}

const std::map<std::string, std::string> kAuth = {
  {"AUTH0_DOMAIN", "tenant.eu.auth0.com"},
  {"AUTH0_AUDIENCE", "client-a, client-b"},
  {"ALLOWED_EMAILS", "me@example.com,you@example.com"},
};

std::map<std::string, std::string> with(std::map<std::string, std::string> base,
                                        std::map<std::string, std::string> extra)
{
  for (auto& [key, value] : extra)
  {
    base[key] = value;
  }
  return base;
}

} // namespace

TEST_CASE("saying nothing listens on this machine only, with no auth",
          "[standalone]") {
  const auto config = readStandaloneConfig({}, environment({}));

  REQUIRE(config.error.empty());
  REQUIRE(config.bind == "127.0.0.1");
  REQUIRE(config.port == 5556);
  REQUIRE(config.auth.mode == AuthMode::None);
  REQUIRE(config.allowedOrigins == "*");
}

TEST_CASE("the arguments it always took still mean what they meant",
          "[standalone]") {
  const auto config = readStandaloneConfig(
    {"9000", "192.168.1.5", "board.json"}, environment({{"PORT", "7000"}}));

  REQUIRE(config.port == 9000);
  REQUIRE(config.externalHost == "192.168.1.5");
  REQUIRE(config.runtimeConfigFile == "board.json");
  // The external address is what it says of itself, not what it listens on.
  REQUIRE(config.bind == "127.0.0.1");
}

TEST_CASE("an open bind without saying who may use it is refused",
          "[standalone][auth]") {
  const auto config = readStandaloneConfig({}, environment({{"HOST", "0.0.0.0"}}));

  REQUIRE_FALSE(config.error.empty());
  REQUIRE(config.error.find("AUTH0_DOMAIN") != std::string::npos);
  REQUIRE(config.error.find("AUTH0_AUDIENCE") != std::string::npos);
  REQUIRE(config.error.find("ALLOWED_EMAILS") != std::string::npos);
}

TEST_CASE("an open bind names exactly what is still missing",
          "[standalone][auth]") {
  // An issuer with nobody allowed would deny every request: said at start.
  const auto config = readStandaloneConfig({}, environment({
    {"HOST", "0.0.0.0"},
    {"AUTH0_DOMAIN", "tenant.eu.auth0.com"},
    {"AUTH0_AUDIENCE", "client-a"},
  }));

  REQUIRE(config.error.find("ALLOWED_EMAILS") != std::string::npos);
  REQUIRE(config.error.find("AUTH0_DOMAIN") == std::string::npos);
}

TEST_CASE("an open bind with all three is served, authenticated",
          "[standalone][auth]") {
  const auto config = readStandaloneConfig(
    {}, environment(with(kAuth, {{"HOST", "0.0.0.0"}, {"PORT", "8887"}})));

  REQUIRE(config.error.empty());
  REQUIRE(config.bind == "0.0.0.0");
  REQUIRE(config.port == 8887);
  REQUIRE(config.auth.mode == AuthMode::Jwt);
  REQUIRE(config.auth.issuers.size() == 1);
  // The issuer as Auth0 writes it into a token.
  REQUIRE(config.auth.issuers[0].iss == "https://tenant.eu.auth0.com/");
  REQUIRE(config.auth.issuers[0].audiences ==
          std::vector<std::string>{"client-a", "client-b"});
  REQUIRE(config.auth.allowedEmails ==
          std::vector<std::string>{"me@example.com", "you@example.com"});
}

TEST_CASE("auth may be asked for on a loopback bind too", "[standalone][auth]") {
  const auto config = readStandaloneConfig({}, environment(kAuth));

  REQUIRE(config.error.empty());
  REQUIRE(config.auth.mode == AuthMode::Jwt);
}

TEST_CASE("an exposed server says which origins may call it",
          "[standalone]") {
  const auto config = readStandaloneConfig({}, environment(with(kAuth, {
    {"HOST", "0.0.0.0"},
    {"ALLOWED_ORIGINS", "https://readymadeit.com"},
  })));

  REQUIRE(config.allowedOrigins == "https://readymadeit.com");
}

TEST_CASE("tickets are kept beside this server's data unless told otherwise",
          "[standalone]") {
  REQUIRE(readStandaloneConfig({}, environment({{"HOME", "/home/hkp"}})).linksFile ==
          "/home/hkp/.hkp/cpp/coordinator-links.json");
  REQUIRE(readStandaloneConfig({}, environment({
    {"HOME", "/home/hkp"}, {"HKP_COORDINATOR_LINKS_FILE", "/data/links.json"},
  })).linksFile == "/data/links.json");
  // Set to nothing: in memory only.
  REQUIRE(readStandaloneConfig({}, environment({
    {"HOME", "/home/hkp"}, {"HKP_COORDINATOR_LINKS_FILE", ""},
  })).linksFile.empty());
}

TEST_CASE("the address it is reached at from outside loses a trailing slash",
          "[standalone]") {
  REQUIRE(readStandaloneConfig({}, environment({
    {"HKP_EXTERNAL_URL", "https://rt.example.com/"},
  })).externalUrl == "https://rt.example.com");
}

TEST_CASE("the mount secret comes from the environment, else from beside its data",
          "[standalone][mounts]") {
  const auto fromEnv = readStandaloneConfig({}, environment({
    {"HOME", "/home/hkp"}, {"HKP_MOUNT_SECRET", "s3cret"},
  }));
  REQUIRE(fromEnv.mountSecret == "s3cret");

  const auto fromFile = readStandaloneConfig({}, environment({{"HOME", "/home/hkp"}}));
  REQUIRE(fromFile.mountSecret.empty());
  REQUIRE(fromFile.mountSecretFile == "/home/hkp/.hkp/cpp/mount-secret");
}
