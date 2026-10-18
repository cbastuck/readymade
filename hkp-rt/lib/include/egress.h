#pragma once

#include <boost/asio/ip/address.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/system/error_code.hpp>

#include <cstdint>
#include <mutex>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace hkp
{

/**
 * Where a board may make this server connect to.
 *
 * A board names destinations — an HTTP Client's URL, an asset, a model's base
 * URL, a WebSocket to write to — and the server dials them. On a person's own
 * machine that is the point; the desktop app's embedded runtime is never told
 * otherwise. On a server several people's boards run on it is not: its
 * loopback, its private network and a cloud provider's metadata endpoint
 * (`169.254.169.254`, which hands out the instance's credentials) are reachable
 * from here and are not a board's to reach.
 *
 * So a standalone server can be told it is hosted (`HKP_EGRESS=public`, read by
 * standalone_config.h): a destination is reached only when every address its
 * name resolves to is a public internet address.
 *
 * **Judged on what the resolver answers, which is what is connected to.**
 * Every site that dials a board's destination resolves through `resolve` or
 * `asyncResolve` here and connects to the endpoints they return, so there is
 * no second lookup to answer differently; an address literal resolves to
 * itself and is judged the same way. `tests/egress_sources.test.cpp` fails on
 * a resolve anywhere else. Connections the operator configured — the
 * coordinator link, the token issuer's keys — are not a board's destinations
 * and are not judged here.
 *
 * The same rule, range for range, is in hkp-node (`src/egress.ts`) and
 * hkp-python (`src/hkp/egress.py`).
 */
namespace egress
{

/** An address range: the address as bytes, and how many leading bits count. */
struct Range
{
  std::vector<uint8_t> bytes;
  int bits = 0;
};

struct Policy
{
  bool hosted = false;
  /** Addresses and ranges reached anyway, as the operator listed them. */
  std::vector<Range> allow;
};

inline bool toBytes(const std::string& text, std::vector<uint8_t>& out)
{
  std::string plain = text;
  if (plain.size() >= 2 && plain.front() == '[' && plain.back() == ']')
  {
    plain = plain.substr(1, plain.size() - 2);
  }
  if (const auto zone = plain.find('%'); zone != std::string::npos)
  {
    plain.erase(zone);
  }
  boost::system::error_code ec;
  const auto address = boost::asio::ip::make_address(plain, ec);
  if (ec)
  {
    return false;
  }
  if (address.is_v4())
  {
    const auto bytes = address.to_v4().to_bytes();
    out.assign(bytes.begin(), bytes.end());
  }
  else
  {
    const auto bytes = address.to_v6().to_bytes();
    out.assign(bytes.begin(), bytes.end());
  }
  return true;
}

inline bool parseRange(const std::string& text, Range& out)
{
  const auto slash = text.find('/');
  if (!toBytes(text.substr(0, slash), out.bytes))
  {
    return false;
  }
  const int width = static_cast<int>(out.bytes.size() * 8);
  if (slash == std::string::npos)
  {
    out.bits = width;
    return true;
  }
  try
  {
    size_t used = 0;
    out.bits = std::stoi(text.substr(slash + 1), &used);
    return used == text.size() - slash - 1 && out.bits >= 0 && out.bits <= width;
  }
  catch (const std::exception&)
  {
    return false;
  }
}

inline Range range(const char* text)
{
  Range out;
  if (!parseRange(text, out))
  {
    throw std::logic_error(std::string("Not an address or a range: ") + text);
  }
  return out;
}

inline bool inRange(const std::vector<uint8_t>& bytes, const Range& range)
{
  if (bytes.size() != range.bytes.size())
  {
    return false;
  }
  for (int bit = 0; bit < range.bits; ++bit)
  {
    const uint8_t mask = static_cast<uint8_t>(0x80 >> (bit & 7));
    if ((bytes[bit >> 3] & mask) != (range.bytes[bit >> 3] & mask))
    {
      return false;
    }
  }
  return true;
}

/**
 * What is not the public internet: this host, private networks, link-local
 * (where the metadata endpoints are), shared address space, and what is not an
 * address one connects to at all.
 */
inline const std::vector<Range>& notPublic()
{
  static const std::vector<Range> ranges = {
    range("0.0.0.0/8"),     range("127.0.0.0/8"),    range("10.0.0.0/8"),
    range("172.16.0.0/12"), range("192.168.0.0/16"), range("100.64.0.0/10"),
    range("169.254.0.0/16"), range("192.0.0.0/24"),  range("198.18.0.0/15"),
    range("224.0.0.0/4"),   range("240.0.0.0/4"),    range("::/128"),
    range("::1/128"),       range("fe80::/10"),      range("fc00::/7"),
    range("ff00::/8"),
  };
  return ranges;
}

/** IPv6 forms that carry an IPv4 address, and where it sits. Such an address
 *  is the IPv4 address inside it — `::ffff:127.0.0.1` is loopback. */
inline const std::vector<std::pair<Range, size_t>>& carryIPv4()
{
  static const std::vector<std::pair<Range, size_t>> forms = {
    {range("::ffff:0:0/96"), 12},
    {range("64:ff9b::/96"), 12},
    {range("2002::/16"), 2},
  };
  return forms;
}

inline bool isPublicBytes(const std::vector<uint8_t>& bytes)
{
  for (const auto& [form, at] : carryIPv4())
  {
    if (inRange(bytes, form))
    {
      return isPublicBytes(std::vector<uint8_t>(bytes.begin() + at, bytes.begin() + at + 4));
    }
  }
  for (const auto& range : notPublic())
  {
    if (inRange(bytes, range))
    {
      return false;
    }
  }
  return true;
}

/** Whether `text` is a public internet address. Not an address: false. */
inline bool isPublicAddress(const std::string& text)
{
  std::vector<uint8_t> bytes;
  return toBytes(text, bytes) && isPublicBytes(bytes);
}

/**
 * The policy `HKP_EGRESS` and `HKP_EGRESS_ALLOW` state. An entry of the list
 * that is not an address or a range is an error rather than skipped — an
 * operator who meant to allow something should learn now that nothing was —
 * and so is a name, which could be repointed once allowed.
 */
inline Policy readPolicy(const std::string& mode, const std::string& allow, std::string& error)
{
  Policy policy;
  if (mode.empty() || mode == "open")
  {
    return policy;
  }
  if (mode != "public")
  {
    error = "HKP_EGRESS must be \"public\" or unset, not \"" + mode + "\"";
    return policy;
  }
  policy.hosted = true;
  size_t start = 0;
  while (start <= allow.size())
  {
    const auto comma = allow.find(',', start);
    std::string entry = allow.substr(start, comma == std::string::npos ? std::string::npos : comma - start);
    const auto first = entry.find_first_not_of(" \t");
    const auto last = entry.find_last_not_of(" \t");
    entry = first == std::string::npos ? "" : entry.substr(first, last - first + 1);
    if (!entry.empty())
    {
      Range parsed;
      if (!parseRange(entry, parsed))
      {
        error = "HKP_EGRESS_ALLOW: \"" + entry +
                "\" is not an address or a range (names are not accepted: an allowed name could be repointed)";
        return Policy{};
      }
      policy.allow.push_back(parsed);
    }
    if (comma == std::string::npos)
    {
      break;
    }
    start = comma + 1;
  }
  return policy;
}

/** Whether a destination at address `text` may be reached under `policy`. */
inline bool mayReach(const Policy& policy, const std::string& text)
{
  if (!policy.hosted)
  {
    return true;
  }
  std::vector<uint8_t> bytes;
  if (!toBytes(text, bytes))
  {
    return false;
  }
  for (const auto& range : policy.allow)
  {
    if (inRange(bytes, range))
    {
      return true;
    }
  }
  return isPublicBytes(bytes);
}

/** A destination this server will not connect to, and why. */
class Refused : public std::runtime_error
{
public:
  Refused(const std::string& host, const std::string& address)
    : std::runtime_error(host == address
                           ? "This server does not reach private addresses (" + address + ")"
                           : "This server does not reach private addresses (" + host + " is " + address + ")")
  {
  }
};

/** The process's policy. Open until a standalone server is told otherwise. */
inline Policy& activePolicy()
{
  static Policy policy;
  return policy;
}

inline std::mutex& policyMutex()
{
  static std::mutex mutex;
  return mutex;
}

inline void setPolicy(Policy policy)
{
  std::lock_guard lock{policyMutex()};
  activePolicy() = std::move(policy);
}

inline Policy currentPolicy()
{
  std::lock_guard lock{policyMutex()};
  return activePolicy();
}

/** Throws `Refused` when any endpoint `results` holds may not be reached. */
template <class Results>
void check(const std::string& host, const Results& results)
{
  const auto policy = currentPolicy();
  if (!policy.hosted)
  {
    return;
  }
  for (const auto& entry : results)
  {
    const auto address = entry.endpoint().address().to_string();
    if (!mayReach(policy, address))
    {
      throw Refused(host, address);
    }
  }
}

/** `resolver.resolve(host, port)`, refusing a destination that may not be
 *  reached. Connect to what it returns. */
inline boost::asio::ip::tcp::resolver::results_type resolve(boost::asio::ip::tcp::resolver& resolver,
                                                            const std::string& host,
                                                            const std::string& port)
{
  auto results = resolver.resolve(host, port);
  check(host, results);
  return results;
}

/** What an asynchronous refusal says, where only an error code travels. */
inline const boost::system::error_category& category()
{
  struct Category : boost::system::error_category
  {
    const char* name() const noexcept override { return "hkp.egress"; }
    std::string message(int) const override { return "This server does not reach private addresses"; }
  };
  static const Category instance;
  return instance;
}

/** `resolver.async_resolve`, answering the handler with an `hkp.egress`
 *  error and no endpoints for a destination that may not be reached. */
template <class Handler>
void asyncResolve(boost::asio::ip::tcp::resolver& resolver,
                  const std::string& host,
                  const std::string& port,
                  Handler&& handler)
{
  resolver.async_resolve(
    host, port,
    [host, handler = std::forward<Handler>(handler)](const boost::system::error_code& ec,
                                                     boost::asio::ip::tcp::resolver::results_type results) mutable {
      if (!ec)
      {
        try
        {
          check(host, results);
        }
        catch (const Refused&)
        {
          handler(boost::system::error_code(1, category()), boost::asio::ip::tcp::resolver::results_type{});
          return;
        }
      }
      handler(ec, std::move(results));
    });
}

} // namespace egress
} // namespace hkp
