#include <catch2/catch_test_macros.hpp>

#include <boost/asio/io_context.hpp>

#include <egress.h>
#include <standalone_config.h>

#include <map>
#include <string>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Where a board may make a hosted server connect to.
//
// A server several people's boards run on must not dial its own loopback, its
// private network or the cloud metadata endpoint on a board's say-so. Pinned
// here: with HKP_EGRESS=public those are refused on what the resolver answers —
// which is what every board-facing site connects to — and without it nothing
// changes. The same cases are pinned for hkp-node and hkp-python.
// ──────────────────────────────────────────────────────────────────────────────

namespace
{
struct OpenAgain
{
  ~OpenAgain() { egress::setPolicy({}); }
};

void hosted(const std::string& allow = "")
{
  std::string problem;
  egress::setPolicy(egress::readPolicy("public", allow, problem));
  REQUIRE(problem.empty());
}
} // namespace

TEST_CASE("the public internet is everything that is not this host, private or reserved", "[egress]")
{
  for (const auto* address : {"8.8.8.8", "1.1.1.1", "172.32.0.0", "100.128.0.0", "2606:4700:4700::1111", "::ffff:8.8.8.8"})
  {
    INFO(address);
    REQUIRE(egress::isPublicAddress(address));
  }
  for (const auto* address : {
         "0.0.0.0", "127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.0", "172.31.255.255",
         "192.168.1.1", "100.64.0.1", "100.100.100.200", "169.254.169.254", "169.254.170.2",
         "192.0.0.192", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fe80::1",
         "fc00::1", "fd00:ec2::254", "ff02::1", "::127.0.0.1", "64:ff9b:1::a9fe:a9fe",
         // IPv6 forms carrying an IPv4 address are judged by the IPv4 inside.
         "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::",
         // Not an address at all.
         "localhost", "",
       })
  {
    INFO(address);
    REQUIRE_FALSE(egress::isPublicAddress(address));
  }
}

TEST_CASE("a server is open unless it is told it is hosted", "[egress]")
{
  std::string problem;
  REQUIRE_FALSE(egress::readPolicy("", "", problem).hosted);
  REQUIRE_FALSE(egress::readPolicy("open", "", problem).hosted);
  REQUIRE(problem.empty());

  const auto policy = egress::readPolicy("public", "10.0.0.5, 10.1.0.0/16,fd00::/8", problem);
  REQUIRE(problem.empty());
  REQUIRE(policy.hosted);
  REQUIRE(policy.allow.size() == 3);
  REQUIRE(egress::mayReach(policy, "10.0.0.5"));
  REQUIRE(egress::mayReach(policy, "10.1.2.3"));
  REQUIRE_FALSE(egress::mayReach(policy, "10.0.0.6"));
}

TEST_CASE("a setting the server does not understand stops it", "[egress]")
{
  std::string problem;
  egress::readPolicy("private", "", problem);
  REQUIRE(problem.find("HKP_EGRESS") != std::string::npos);

  // A name could be repointed at anything once allowed.
  problem.clear();
  egress::readPolicy("public", "ollama.internal", problem);
  REQUIRE(problem.find("not an address or a range") != std::string::npos);

  const std::map<std::string, std::string> env{{"HKP_EGRESS", "Public"}, {"HKP_EGRESS_ALLOW", "nope"}};
  const auto config = readStandaloneConfig({}, [&env](const char* name) -> const char* {
    const auto found = env.find(name);
    return found == env.end() ? nullptr : found->second.c_str();
  });
  REQUIRE(config.error.find("HKP_EGRESS_ALLOW") != std::string::npos);
}

TEST_CASE("a standalone server reads whether it is hosted from its environment", "[egress]")
{
  const std::map<std::string, std::string> env{{"HKP_EGRESS", " public "}, {"HKP_EGRESS_ALLOW", "10.0.0.5"}};
  const auto config = readStandaloneConfig({}, [&env](const char* name) -> const char* {
    const auto found = env.find(name);
    return found == env.end() ? nullptr : found->second.c_str();
  });
  REQUIRE(config.error.empty());
  REQUIRE(config.egress.hosted);
  REQUIRE(config.egress.allow.size() == 1);

  const auto unset = readStandaloneConfig({}, [](const char*) -> const char* { return nullptr; });
  REQUIRE_FALSE(unset.egress.hosted);
}

TEST_CASE("a hosted server does not resolve a private destination for a board", "[egress]")
{
  OpenAgain reset;
  boost::asio::io_context ioc;
  boost::asio::ip::tcp::resolver resolver(ioc);
  hosted();

  REQUIRE_THROWS_AS(egress::resolve(resolver, "127.0.0.1", "80"), egress::Refused);
  REQUIRE_THROWS_AS(egress::resolve(resolver, "localhost", "80"), egress::Refused);
  REQUIRE_THROWS_AS(egress::resolve(resolver, "169.254.169.254", "80"), egress::Refused);
  try
  {
    egress::resolve(resolver, "10.0.0.5", "443");
    FAIL("resolved");
  }
  catch (const egress::Refused& refused)
  {
    REQUIRE(std::string(refused.what()) == "This server does not reach private addresses (10.0.0.5)");
  }
}

TEST_CASE("a hosted server resolves what the operator allowed", "[egress]")
{
  OpenAgain reset;
  boost::asio::io_context ioc;
  boost::asio::ip::tcp::resolver resolver(ioc);
  // Both of localhost's addresses: a name is reached only when all of them may be.
  hosted("127.0.0.0/8,::1");

  REQUIRE_FALSE(egress::resolve(resolver, "localhost", "80").empty());
}

TEST_CASE("an open server resolves everything, as before", "[egress]")
{
  boost::asio::io_context ioc;
  boost::asio::ip::tcp::resolver resolver(ioc);

  REQUIRE_FALSE(egress::resolve(resolver, "127.0.0.1", "80").empty());
  REQUIRE_FALSE(egress::resolve(resolver, "localhost", "80").empty());
}

TEST_CASE("a refusal arrives as an error where only an error code travels", "[egress]")
{
  OpenAgain reset;
  boost::asio::io_context ioc;
  boost::asio::ip::tcp::resolver resolver(ioc);
  hosted();

  boost::system::error_code answered;
  size_t endpoints = 99;
  egress::asyncResolve(resolver, "127.0.0.1", "80",
                       [&](const boost::system::error_code& ec, boost::asio::ip::tcp::resolver::results_type results) {
                         answered = ec;
                         endpoints = results.size();
                       });
  ioc.run();

  REQUIRE(answered.category() == egress::category());
  REQUIRE(answered.message() == "This server does not reach private addresses");
  REQUIRE(endpoints == 0);
}
