#pragma once

#include <cctype>
#include <string>
#include <string_view>

#include <nlohmann/json.hpp>

/**
 * The OAuth callback an external browser delivers back to the app.
 *
 * Login happens in the OS browser, which cannot reach the webview's own origin
 * (`saucer://embedded` in release builds), so the provider is told to redirect
 * to the app's own loopback HTTP server instead. Two rules govern what arrives
 * there: what a callback's parameters are, and which peers may deliver one.
 *
 * They live apart from the server so they are testable without crow or saucer —
 * this header deliberately depends on nothing but the standard library and
 * nlohmann/json.
 */
namespace readymade
{

/** Percent-decodes one query-string component, `+` as a space included. */
inline std::string decodeComponent(std::string_view value)
{
  auto hexDigit = [](char c) -> int
  {
    if (c >= '0' && c <= '9') { return c - '0'; }
    if (c >= 'a' && c <= 'f') { return c - 'a' + 10; }
    if (c >= 'A' && c <= 'F') { return c - 'A' + 10; }
    return -1;
  };

  std::string decoded;
  decoded.reserve(value.size());
  for (std::size_t i = 0; i < value.size(); ++i)
  {
    if (value[i] == '+')
    {
      decoded.push_back(' ');
      continue;
    }
    if (value[i] == '%' && i + 2 < value.size())
    {
      const auto hi = hexDigit(value[i + 1]);
      const auto lo = hexDigit(value[i + 2]);
      if (hi >= 0 && lo >= 0)
      {
        decoded.push_back(static_cast<char>(hi * 16 + lo));
        i += 2;
        continue;
      }
    }
    decoded.push_back(value[i]);
  }
  return decoded;
}

/**
 * Parses `key=value&key=value` pairs into a JSON object. Pairs without a `=`
 * are skipped; a later duplicate wins.
 */
inline nlohmann::json parseParamString(std::string_view params)
{
  auto json = nlohmann::json::object();

  while (!params.empty())
  {
    const auto amp  = params.find('&');
    const auto pair = params.substr(0, amp);
    const auto eq   = pair.find('=');
    if (eq != std::string_view::npos)
    {
      json[decodeComponent(pair.substr(0, eq))] = decodeComponent(pair.substr(eq + 1));
    }
    if (amp == std::string_view::npos)
    {
      break;
    }
    params = params.substr(amp + 1);
  }

  return json;
}

/**
 * Parses the parameters of a callback URL — its query string and, when the URL
 * carries one, its hash fragment — into a JSON object such as
 * `{"code":"…","state":"…"}`.
 *
 * A fragment never reaches the server on its own (browsers do not send one), so
 * an implicit-flow response has to be posted back by the page the server serves;
 * `parseParamString` is what reads that. This handles the URL as a whole for
 * the cases where both halves are in hand.
 */
inline nlohmann::json parseRedirectParams(std::string_view url)
{
  const auto qPos = url.find('?');
  if (qPos == std::string_view::npos)
  {
    const auto hPos = url.find('#');
    return hPos == std::string_view::npos ? nlohmann::json::object()
                                          : parseParamString(url.substr(hPos + 1));
  }

  auto rest = url.substr(qPos + 1);
  const auto hPos = rest.find('#');
  if (hPos == std::string_view::npos)
  {
    return parseParamString(rest);
  }

  auto json = parseParamString(rest.substr(0, hPos));
  json.update(parseParamString(rest.substr(hPos + 1)));
  return json;
}

/**
 * Whether a peer address is this machine.
 *
 * The callback carries an authorization code, so it is accepted only from the
 * loopback interface — the frontend server itself binds `0.0.0.0` to serve
 * phones on the LAN, and nothing on the LAN has business completing a login
 * that started here. Covers IPv4 loopback in full (`127.0.0.0/8`), IPv6 `::1`,
 * and the IPv4-mapped form a dual-stack socket reports.
 */
inline bool isLoopbackPeer(std::string_view address)
{
  if (address == "::1" || address == "0:0:0:0:0:0:0:1")
  {
    return true;
  }

  constexpr std::string_view mappedPrefix = "::ffff:";
  if (address.size() > mappedPrefix.size() && address.substr(0, mappedPrefix.size()) == mappedPrefix)
  {
    address = address.substr(mappedPrefix.size());
  }

  return address.size() >= 4 && address.substr(0, 4) == "127.";
}

} // namespace readymade
