#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace hkp
{

// A verified caller identity extracted from a bearer token.
struct Principal
{
  std::string email;
  std::string sub;
  std::string iss;
};

// A trusted OIDC issuer. A token is accepted only if it is signed by a key from
// this issuer's JWKS and its `aud` claim is one of `audiences`. It is `iss`+`aud`
// that defines a trusted issuer — `sub` identifies the *user* and is matched
// separately against the allow-list.
struct TrustedIssuer
{
  std::string iss;                     // exact `iss` claim, e.g. "https://hookitapp.eu.auth0.com/"
  std::string jwksUri;                 // JWKS endpoint; derived from `iss` when empty
  std::vector<std::string> audiences;  // acceptable `aud` values (e.g. SPA client ids)
};

enum class AuthMode
{
  None,  // every request is authorized (loopback / dev). The bind is the boundary.
  Jwt,   // bearer token must verify against a trusted issuer and an allowed email.
};

struct AuthConfig
{
  AuthMode mode = AuthMode::None;
  std::vector<TrustedIssuer> issuers;
  std::vector<std::string> allowedEmails;  // matched case-insensitively
};

enum class AuthStatus
{
  Ok,               // authorized; `principal` is set
  Unauthenticated,  // missing/invalid/untrusted token → HTTP 401
  Forbidden,        // valid token, but identity is not allowed → HTTP 403
};

struct AuthResult
{
  AuthStatus status = AuthStatus::Unauthenticated;
  std::optional<Principal> principal;
};

// Resolves an opaque (non-JWT) bearer token to a principal, or nullopt.
//
// Reserved for future server-to-server ephemeral session tokens — the same
// shape as hkp-node's OpaqueTokenResolver, where a long-lived caller keeps
// acting on a user's behalf past JWT expiry. The LAN peer model has no such
// intermediary today, so this is unset; the seam lets us add it later as a
// localized change rather than a middleware refactor. Checked BEFORE JWT
// verification, exactly like hkp-node.
using OpaqueTokenResolver =
    std::function<std::optional<Principal>(const std::string& token)>;

// True when `host` is reachable only from the local machine. A loopback bind is
// itself an access-control boundary, so running without auth there is safe
// (matches hkp-node's isLoopbackHost).
bool isLoopbackHost(const std::string& host);

// Verifies bearer tokens against a fixed set of trusted issuers (JWKS-backed
// RS256) and authorizes them against an email allow-list. Thread-safe; the JWKS
// cache is populated lazily and refreshed on an unknown key id.
class Authenticator
{
public:
  explicit Authenticator(AuthConfig config, OpaqueTokenResolver resolveOpaque = {});
  ~Authenticator();

  Authenticator(const Authenticator&) = delete;
  Authenticator& operator=(const Authenticator&) = delete;

  Authenticator(Authenticator&&) noexcept;
  Authenticator& operator=(Authenticator&&) noexcept;

  // True when mode == None: every request is authorized without a token.
  bool isNoAuth() const;

  // True when the config cannot authorize anyone (Jwt mode with no issuers or no
  // allowed emails). Callers that resolve to this while exposed are running
  // fail-closed: every authorize() denies. Surfaced so startup can warn loudly.
  bool isMisconfigured() const;

  // Authorizes a raw Authorization header value (e.g. "Bearer eyJ...").
  AuthResult authorize(const std::string& authorizationHeader) const;

  // Replaces the allow-listed emails at runtime (thread-safe). Used by hosts
  // that learn the permitted identity after the server starts — e.g. iOS pushes
  // the signed-in user's email once login completes. Issuers/mode are fixed at
  // construction; only the allow-list is mutable.
  void setAllowedEmails(std::vector<std::string> emails);

  // Pins a PEM signing key for (iss, kid), bypassing the JWKS fetch for that
  // key. Useful for offline key pinning and for deterministic, network-free
  // tests. Safe to call before serving.
  void pinSigningKey(const std::string& iss, const std::string& kid, const std::string& pem);

private:
  struct Impl;
  std::unique_ptr<Impl> m_impl;
};

}  // namespace hkp
