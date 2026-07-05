#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <string>

#include <nlohmann/json.hpp>

#ifndef JWT_DISABLE_PICOJSON
#define JWT_DISABLE_PICOJSON
#endif
#include <jwt-cpp/traits/nlohmann-json/traits.h>

#include <auth.h>

using namespace hkp;
using Traits = jwt::traits::nlohmann_json;
using Clock = std::chrono::system_clock;

namespace
{
// Deterministic test RSA keypair (2048-bit). The public key is pinned on the
// Authenticator; tokens are minted with the private key. This keeps the whole
// verification path network-free.
const std::string kPrivateKey = R"(-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAqnILDcP+SMkXmhVN+NA6iUzS74zdXO+bZFjA1p1fp69OYNie
ywUtplk/rzpZKl3vtnSt9az5hV+a/On0AMGnrpMoiR3lSD1EsDu6qQbv+4nquf/h
b1qm8msO+vrrREtNEjwNbudItSQMlz9Qb11m7ZnaJzZE3yWHv/NgLuKsh/1uVKVX
TYcI43F+EIhDjn119rsAGnK6e3TIBGAAZ5OtQTtQ3h47+UDSdMMSxI6NQf4o4pmh
7Dfv7Cw2rB2xhBdGwTCkLhDIHXVIHgdDIu+Rd2NcR/RhmS0Uyb/QrsBTGlMWJQEq
ie1EaLgkcHpiUSShSI53/jNf5jfTPEQarynMRwIDAQABAoIBAG1T610wC0o6moX+
Bl6DihiJi3+WVmMHWiAagc7ncPTJELg0Gl7U+nwKITxPa+QuDtV0sCS2h/KR6YMy
uY1GqjzjLYwN/gTBL+7u0QMcbRBmXYZi6AIaHp2+KAS6r+/FcTEyDdfGSK/P6LeX
KAvW2G+tUO339GNB2no4LMjGIq6yxw77NrBcG+sU2Vm8vY0Kt39eFFa63z+PWSSZ
64gJ5m8Vr+Z8ijrDM0pu+p0271eItmBBRA8qsZDD6J7TPHOqR6DJk1H/XbyHGEdg
jICjPRH9F727lXC+KjBZAAP8nWousOiB9dOdygY2HLImlxt47/kPKL5xNsjf5JMH
bF72tdECgYEA3N2vXy/XjuGmppbbdCaGzY5zIkPmMhF4weY44oiWB3dJRPoLm2+e
2KMP/BtEh48Th48ikI6Fxs0lYAQaJ9JYe64wNthVUPnOBrPsWR+Qs0Qcd+tYEaY+
hIEBU88ZUSnPunYkrOkNogc4ofn29tm3DRvU4VIvNTh/YfzzNl6bQ7kCgYEAxY8W
VTI4w9bnHUYa/hSJZWmB4vX4rtzicr/O36Uduede+3DsOeD4l4AX94wEk3fhhsAB
0U3SNphlHpwaV77rWFD1c9Xb6fI6nQWFDiSr7Mcv0CT6RZs6Wj1P76S6oG+PNV7V
xxS5O9bto7MqsFMHUi9TFDR1y9i3idB5ZjWVj/8CgYA2HtBJV9TPOzX13kN6K7Ke
jghiXhb7L9LSWJKZ1/RDchRvJYJQnUJkPVi+YwQg34tejVFf8LyRIVXGOFscZOuv
qtg/qDUHuZ6lf9MrZ5Oyib8cF3wmHwF0wJPNsJK4k7FGNIr6H8VqbbCP6Et+44x6
VtaMO/I7bVOxdCU4rmgHaQKBgQCopCRkRaK/SkuvaZDRI6bFsvL1UxMd8eA8JA/s
SX6+mwsxiIuePLT4XpgW8KdXWxZheLYUfWHcyOpI3uh9zrQHh9R/NSes5OGz+GpE
UHmSfdYK0AX0NTXyojQCVZQaMCEHZhUHBGG6+xWQj/j422d8eHlq3f1QLYc/VX7M
CSHK8QKBgGHyiLY08KH99zrrKkrBEWD31MmQhROTxjb2SoOTlAdtqzs4LgcW+9l3
51MgLT2yzUJQBK4akB6/40oz65NlxtrjZGpiPIAvNu+5cVbpakc5EGoSB0xgjCCv
OTPBQOC/PpuTpAo7A13Hiz7h2VUzZNtvvHPBmyJ0Zwimr64v06JD
-----END RSA PRIVATE KEY-----)";

const std::string kPublicKey = R"(-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqnILDcP+SMkXmhVN+NA6
iUzS74zdXO+bZFjA1p1fp69OYNieywUtplk/rzpZKl3vtnSt9az5hV+a/On0AMGn
rpMoiR3lSD1EsDu6qQbv+4nquf/hb1qm8msO+vrrREtNEjwNbudItSQMlz9Qb11m
7ZnaJzZE3yWHv/NgLuKsh/1uVKVXTYcI43F+EIhDjn119rsAGnK6e3TIBGAAZ5Ot
QTtQ3h47+UDSdMMSxI6NQf4o4pmh7Dfv7Cw2rB2xhBdGwTCkLhDIHXVIHgdDIu+R
d2NcR/RhmS0Uyb/QrsBTGlMWJQEqie1EaLgkcHpiUSShSI53/jNf5jfTPEQarynM
RwIDAQAB
-----END PUBLIC KEY-----)";

constexpr const char* kIssuer = "https://hookitapp.eu.auth0.com/";
constexpr const char* kAudience = "spa-client-id";
constexpr const char* kKid = "test-key-1";
constexpr const char* kEmail = "mail@cbastuck.de";

struct TokenOpts
{
  std::string issuer = kIssuer;
  std::string audience = kAudience;
  std::string kid = kKid;
  std::string email = kEmail;
  bool emailVerified = true;
  bool expired = false;
};

std::string mintToken(const TokenOpts& opts)
{
  const auto now = Clock::now();
  return jwt::create<Traits>()
      .set_issuer(opts.issuer)
      .set_audience(opts.audience)
      .set_key_id(opts.kid)
      .set_issued_at(now - std::chrono::minutes(1))
      .set_expires_at(opts.expired ? now - std::chrono::hours(1) : now + std::chrono::hours(1))
      .set_subject("auth0|abc123")
      .set_payload_claim("email", jwt::basic_claim<Traits>(nlohmann::json(opts.email)))
      .set_payload_claim("email_verified",
                         jwt::basic_claim<Traits>(nlohmann::json(opts.emailVerified)))
      .sign(jwt::algorithm::rs256(kPublicKey, kPrivateKey, "", ""));
}

AuthConfig jwtConfig()
{
  AuthConfig config;
  config.mode = AuthMode::Jwt;
  config.issuers.push_back(TrustedIssuer{kIssuer, "", {kAudience}});
  config.allowedEmails.push_back(kEmail);
  return config;
}

Authenticator makeAuthenticator()
{
  Authenticator auth(jwtConfig());
  auth.pinSigningKey(kIssuer, kKid, kPublicKey);
  return auth;
}

std::string bearer(const std::string& token)
{
  return "Bearer " + token;
}
}  // namespace

TEST_CASE("isLoopbackHost recognises local addresses", "[auth]")
{
  CHECK(isLoopbackHost("127.0.0.1"));
  CHECK(isLoopbackHost("127.1.2.3"));
  CHECK(isLoopbackHost("localhost"));
  CHECK(isLoopbackHost("::1"));
  CHECK(isLoopbackHost("::ffff:127.0.0.1"));
  CHECK(isLoopbackHost("  LOCALHOST "));
  CHECK_FALSE(isLoopbackHost("0.0.0.0"));
  CHECK_FALSE(isLoopbackHost("192.168.1.5"));
}

TEST_CASE("None mode authorizes every request", "[auth]")
{
  Authenticator auth(AuthConfig{});  // default mode == None
  CHECK(auth.isNoAuth());
  CHECK_FALSE(auth.isMisconfigured());
  CHECK(auth.authorize("").status == AuthStatus::Ok);
  CHECK(auth.authorize("garbage").status == AuthStatus::Ok);
}

TEST_CASE("Jwt mode with empty config is misconfigured and denies", "[auth]")
{
  AuthConfig config;
  config.mode = AuthMode::Jwt;  // exposed, but no issuers / allowed users
  Authenticator auth(config);
  CHECK_FALSE(auth.isNoAuth());
  CHECK(auth.isMisconfigured());
  // A well-formed, correctly-signed token is still denied: no trusted issuer.
  Authenticator pinned(config);
  pinned.pinSigningKey(kIssuer, kKid, kPublicKey);
  CHECK(pinned.authorize(bearer(mintToken({}))).status == AuthStatus::Unauthenticated);
}

TEST_CASE("Missing or malformed Authorization is unauthenticated", "[auth]")
{
  auto auth = makeAuthenticator();
  CHECK(auth.authorize("").status == AuthStatus::Unauthenticated);
  CHECK(auth.authorize("Bearer ").status == AuthStatus::Unauthenticated);
  CHECK(auth.authorize("Basic abc").status == AuthStatus::Unauthenticated);
  CHECK(auth.authorize("Bearer not-a-jwt").status == AuthStatus::Unauthenticated);
}

TEST_CASE("A valid, allow-listed token is authorized", "[auth]")
{
  auto auth = makeAuthenticator();
  const auto result = auth.authorize(bearer(mintToken({})));
  REQUIRE(result.status == AuthStatus::Ok);
  REQUIRE(result.principal.has_value());
  CHECK(result.principal->email == kEmail);
  CHECK(result.principal->iss == kIssuer);
  CHECK(result.principal->sub == "auth0|abc123");
}

TEST_CASE("Email allow-list is enforced", "[auth]")
{
  auto auth = makeAuthenticator();
  TokenOpts opts;
  opts.email = "intruder@example.com";
  CHECK(auth.authorize(bearer(mintToken(opts))).status == AuthStatus::Forbidden);
}

TEST_CASE("Allow-list match is case-insensitive", "[auth]")
{
  auto auth = makeAuthenticator();
  TokenOpts opts;
  opts.email = "Mail@CBastuck.DE";
  CHECK(auth.authorize(bearer(mintToken(opts))).status == AuthStatus::Ok);
}

TEST_CASE("Unverified email is forbidden", "[auth]")
{
  auto auth = makeAuthenticator();
  TokenOpts opts;
  opts.emailVerified = false;
  CHECK(auth.authorize(bearer(mintToken(opts))).status == AuthStatus::Forbidden);
}

TEST_CASE("Wrong audience is rejected", "[auth]")
{
  auto auth = makeAuthenticator();
  TokenOpts opts;
  opts.audience = "some-other-client";
  CHECK(auth.authorize(bearer(mintToken(opts))).status == AuthStatus::Unauthenticated);
}

TEST_CASE("Untrusted issuer is rejected", "[auth]")
{
  auto auth = makeAuthenticator();
  TokenOpts opts;
  opts.issuer = "https://evil.example.com/";
  CHECK(auth.authorize(bearer(mintToken(opts))).status == AuthStatus::Unauthenticated);
}

TEST_CASE("Expired token is rejected", "[auth]")
{
  auto auth = makeAuthenticator();
  TokenOpts opts;
  opts.expired = true;
  CHECK(auth.authorize(bearer(mintToken(opts))).status == AuthStatus::Unauthenticated);
}

TEST_CASE("Tampered signature is rejected", "[auth]")
{
  auto auth = makeAuthenticator();
  auto token = mintToken({});
  // Flip a character at the start of the signature segment. (Flipping the very
  // last character is unreliable: the RS256 signature is 2048 bits, so the final
  // base64url character carries only 2 meaningful bits with 4 zero-padding bits,
  // and a lenient decoder ignores those — the decoded signature would be
  // unchanged.)
  const auto sigStart = token.find_last_of('.') + 1;
  REQUIRE(sigStart < token.size());
  token[sigStart] = (token[sigStart] == 'A') ? 'B' : 'A';
  CHECK(auth.authorize(bearer(token)).status == AuthStatus::Unauthenticated);
}
