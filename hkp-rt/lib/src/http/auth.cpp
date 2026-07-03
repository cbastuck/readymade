#include "auth.h"

#include <algorithm>
#include <cctype>
#include <iostream>
#include <map>
#include <mutex>
#include <set>

#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <boost/url.hpp>

#ifndef JWT_DISABLE_PICOJSON
#define JWT_DISABLE_PICOJSON
#endif
#include <jwt-cpp/traits/nlohmann-json/traits.h>

#include "../services/root_certificates.h"

namespace
{
namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = net::ssl;
namespace urls = boost::urls;
using tcp = net::ip::tcp;

using Traits = jwt::traits::nlohmann_json;

std::string toLower(std::string s)
{
  std::transform(s.begin(), s.end(), s.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return s;
}

std::string trim(const std::string& s)
{
  const auto begin = s.find_first_not_of(" \t\r\n");
  if (begin == std::string::npos)
  {
    return "";
  }
  const auto end = s.find_last_not_of(" \t\r\n");
  return s.substr(begin, end - begin + 1);
}

// Synchronous HTTPS GET with peer verification, mirroring the established
// pattern in services/http_client.cpp. Returns the response body, or nullopt on
// any failure (the caller treats a fetch failure as "cannot verify" → deny).
std::optional<std::string> fetchHttps(const std::string& url)
{
  try
  {
    auto parsed = urls::parse_uri(url);
    if (!parsed || parsed->scheme_id() != urls::scheme::https)
    {
      return std::nullopt;
    }

    const auto host = std::string(parsed->encoded_host());
    std::string port = parsed->port();
    if (port.empty())
    {
      port = "443";
    }
    auto target = std::string(parsed->encoded_path());
    if (target.empty())
    {
      target = "/";
    }
    if (!parsed->encoded_query().empty())
    {
      target += "?" + std::string(parsed->encoded_query());
    }

    net::io_context ioc;
    ssl::context ctx(ssl::context::tlsv12_client);
    load_root_certificates(ctx);
    ctx.set_verify_mode(ssl::verify_peer);

    tcp::resolver resolver(ioc);
    beast::ssl_stream<beast::tcp_stream> stream(ioc, ctx);
    if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str()))
    {
      return std::nullopt;
    }

    const auto results = resolver.resolve(host, port);
    beast::get_lowest_layer(stream).connect(results);
    stream.handshake(ssl::stream_base::client);

    http::request<http::string_body> req{http::verb::get, target, 11};
    req.set(http::field::host, host);
    req.set(http::field::user_agent, "hkp-rt-auth");
    http::write(stream, req);

    beast::flat_buffer buffer;
    http::response<http::dynamic_body> res;
    http::read(stream, buffer, res);

    beast::error_code ec;
    stream.shutdown(ec);  // close_notify is often skipped by servers; ignore.

    if (res.result() != http::status::ok)
    {
      return std::nullopt;
    }
    return beast::buffers_to_string(res.body().data());
  }
  catch (const std::exception& e)
  {
    std::cerr << "[auth] JWKS fetch failed: " << e.what() << std::endl;
    return std::nullopt;
  }
}

// Reads a claim that an IdP may encode as either a JSON boolean or the string
// "true" (both occur in the wild for email_verified).
bool claimIsTrue(const jwt::decoded_jwt<Traits>& token, const std::string& name)
{
  if (!token.has_payload_claim(name))
  {
    return false;
  }
  try
  {
    const auto value = token.get_payload_claim(name).to_json();
    if (value.is_boolean())
    {
      return value.get<bool>();
    }
    if (value.is_string())
    {
      return value.get<std::string>() == "true";
    }
  }
  catch (...)
  {
  }
  return false;
}

std::string readStringClaim(const jwt::decoded_jwt<Traits>& token, const std::string& name)
{
  if (!token.has_payload_claim(name))
  {
    return "";
  }
  try
  {
    return token.get_payload_claim(name).as_string();
  }
  catch (...)
  {
    return "";
  }
}

}  // namespace

namespace hkp
{

bool isLoopbackHost(const std::string& host)
{
  auto h = toLower(trim(host));
  // Strip an IPv4-mapped IPv6 prefix so e.g. "::ffff:127.0.0.1" (what a
  // dual-stack socket may report as the remote address) is recognised.
  if (h.rfind("::ffff:", 0) == 0)
  {
    h = h.substr(7);
  }
  return h == "localhost" || h == "::1" || h == "[::1]" || h.rfind("127.", 0) == 0;
}

struct Authenticator::Impl
{
  AuthConfig config;
  OpaqueTokenResolver resolveOpaque;

  // iss → (kid → PEM public key). Populated lazily, refreshed on unknown kid.
  std::map<std::string, std::map<std::string, std::string>> jwksByIssuer;
  std::mutex jwksMutex;

  // Guards config.allowedEmails, which (unlike issuers/mode) can be updated at
  // runtime via setAllowedEmails — e.g. iOS pushes the signed-in user's email
  // once login completes. Read on Crow IO threads, written from the host app.
  mutable std::mutex emailsMutex;

  const TrustedIssuer* findIssuer(const std::string& iss) const
  {
    for (const auto& issuer : config.issuers)
    {
      if (issuer.iss == iss)
      {
        return &issuer;
      }
    }
    return nullptr;
  }

  bool emailAllowed(const std::string& email) const
  {
    const auto needle = toLower(email);
    std::lock_guard<std::mutex> lock(emailsMutex);
    return std::any_of(config.allowedEmails.begin(), config.allowedEmails.end(),
                       [&](const std::string& allowed) { return toLower(allowed) == needle; });
  }

  static std::string jwksUriFor(const TrustedIssuer& issuer)
  {
    if (!issuer.jwksUri.empty())
    {
      return issuer.jwksUri;
    }
    std::string base = issuer.iss;
    if (!base.empty() && base.back() == '/')
    {
      base.pop_back();
    }
    return base + "/.well-known/jwks.json";
  }

  // Returns the PEM signing key for (iss, kid), fetching the JWKS if the kid is
  // not cached. `allowRefresh` guards a single refetch on a cache miss.
  std::optional<std::string> signingKey(const TrustedIssuer& issuer, const std::string& kid,
                                        bool allowRefresh)
  {
    {
      std::lock_guard<std::mutex> lock(jwksMutex);
      auto issIt = jwksByIssuer.find(issuer.iss);
      if (issIt != jwksByIssuer.end())
      {
        auto kidIt = issIt->second.find(kid);
        if (kidIt != issIt->second.end())
        {
          return kidIt->second;
        }
      }
    }

    if (!allowRefresh)
    {
      return std::nullopt;
    }

    const auto body = fetchHttps(jwksUriFor(issuer));
    if (!body)
    {
      return std::nullopt;
    }

    try
    {
      auto keys = jwt::parse_jwks<Traits>(*body);
      std::map<std::string, std::string> parsed;
      for (const auto& jwk : keys)
      {
        if (!jwk.has_key_id() || !jwk.has_x5c())
        {
          continue;
        }
        const auto pem = jwt::helper::convert_base64_der_to_pem(jwk.get_x5c_key_value());
        parsed[jwk.get_key_id()] = pem;
      }
      {
        std::lock_guard<std::mutex> lock(jwksMutex);
        jwksByIssuer[issuer.iss] = std::move(parsed);
      }
    }
    catch (const std::exception& e)
    {
      std::cerr << "[auth] JWKS parse failed for " << issuer.iss << ": " << e.what() << std::endl;
      return std::nullopt;
    }

    return signingKey(issuer, kid, /*allowRefresh=*/false);
  }
};

Authenticator::Authenticator(AuthConfig config, OpaqueTokenResolver resolveOpaque)
    : m_impl(std::make_unique<Impl>())
{
  m_impl->config = std::move(config);
  m_impl->resolveOpaque = std::move(resolveOpaque);
}

Authenticator::~Authenticator() = default;
Authenticator::Authenticator(Authenticator&&) noexcept = default;
Authenticator& Authenticator::operator=(Authenticator&&) noexcept = default;

bool Authenticator::isNoAuth() const
{
  return m_impl->config.mode == AuthMode::None;
}

bool Authenticator::isMisconfigured() const
{
  if (m_impl->config.mode != AuthMode::Jwt)
  {
    return false;
  }
  if (m_impl->config.issuers.empty())
  {
    return true;
  }
  std::lock_guard<std::mutex> lock(m_impl->emailsMutex);
  return m_impl->config.allowedEmails.empty();
}

void Authenticator::setAllowedEmails(std::vector<std::string> emails)
{
  std::lock_guard<std::mutex> lock(m_impl->emailsMutex);
  m_impl->config.allowedEmails = std::move(emails);
}

void Authenticator::pinSigningKey(const std::string& iss, const std::string& kid,
                                  const std::string& pem)
{
  std::lock_guard<std::mutex> lock(m_impl->jwksMutex);
  m_impl->jwksByIssuer[iss][kid] = pem;
}

AuthResult Authenticator::authorize(const std::string& authorizationHeader) const
{
  if (m_impl->config.mode == AuthMode::None)
  {
    // Identity is irrelevant in no-auth mode; hand back a stable principal so
    // downstream code that reads it still works.
    return {AuthStatus::Ok, Principal{"anonymous@localhost", "anonymous", ""}};
  }

  const std::string prefix = "Bearer ";
  if (authorizationHeader.rfind(prefix, 0) != 0)
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }
  const std::string token = authorizationHeader.substr(prefix.size());
  if (token.empty())
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }

  // Opaque (session) tokens resolve locally without a network round-trip, so
  // check them first — mirrors hkp-node. Currently always unset.
  if (m_impl->resolveOpaque)
  {
    if (auto principal = m_impl->resolveOpaque(token))
    {
      return {AuthStatus::Ok, std::move(principal)};
    }
  }

  // decoded_jwt has no default constructor; hold it in an optional so a parse
  // failure is a clean early return rather than a half-built object.
  std::optional<jwt::decoded_jwt<Traits>> decodedOpt;
  try
  {
    decodedOpt = jwt::decode<Traits>(token);
  }
  catch (...)
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }
  const auto& decoded = *decodedOpt;

  if (!decoded.has_issuer() || !decoded.has_key_id())
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }

  const TrustedIssuer* issuer = m_impl->findIssuer(decoded.get_issuer());
  if (!issuer)
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }

  const auto pem = m_impl->signingKey(*issuer, decoded.get_key_id(), /*allowRefresh=*/true);
  if (!pem)
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }

  // Verify signature, expiry and issuer. Audience is checked manually below so
  // multiple acceptable audiences are supported.
  try
  {
    auto verifier = jwt::verify<Traits>()
                        .allow_algorithm(jwt::algorithm::rs256(*pem, "", "", ""))
                        .with_issuer(issuer->iss)
                        .leeway(60);
    verifier.verify(decoded);
  }
  catch (...)
  {
    return {AuthStatus::Unauthenticated, std::nullopt};
  }

  // Audience: the token's aud must contain one of the issuer's accepted values.
  if (!issuer->audiences.empty())
  {
    std::set<std::string> tokenAud;
    if (decoded.has_audience())
    {
      tokenAud = decoded.get_audience();
    }
    const bool audienceOk =
        std::any_of(issuer->audiences.begin(), issuer->audiences.end(),
                    [&](const std::string& accepted) { return tokenAud.count(accepted) > 0; });
    if (!audienceOk)
    {
      return {AuthStatus::Unauthenticated, std::nullopt};
    }
  }

  // Token is authentic. Now authorize the identity: require a verified email on
  // the allow-list. An empty allow-list denies everyone (fail-closed).
  const std::string email = readStringClaim(decoded, "email");
  if (email.empty() || !claimIsTrue(decoded, "email_verified"))
  {
    return {AuthStatus::Forbidden, std::nullopt};
  }
  if (!m_impl->emailAllowed(email))
  {
    return {AuthStatus::Forbidden, std::nullopt};
  }

  Principal principal;
  principal.email = email;
  principal.sub = readStringClaim(decoded, "sub");
  principal.iss = issuer->iss;
  return {AuthStatus::Ok, std::move(principal)};
}

}  // namespace hkp
