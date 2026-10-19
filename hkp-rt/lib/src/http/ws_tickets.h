#pragma once

#include <openssl/rand.h>

#include <chrono>
#include <deque>
#include <functional>
#include <map>
#include <mutex>
#include <optional>
#include <string>
#include <utility>

namespace hkp
{

/**
 * Single-use tickets that open a WebSocket in place of a token.
 *
 * A browser cannot set a header on a WebSocket handshake, so a token it
 * authenticated one with would have to ride in the address — and an address is
 * what proxies and access logs keep. So a browser first asks for a ticket
 * (`POST /ws-tickets`, with its token in the `Authorization` header like any
 * request) and opens the socket with `?ticket=` instead. A ticket opens one
 * socket, within seconds, as whoever asked for it, and is worth nothing once
 * written down.
 *
 * The same in hkp-node (`src/wsTickets.ts`) and hkp-python (`ws_tickets.py`).
 */
template <class Holder>
class WsTickets
{
public:
  using Clock = std::chrono::steady_clock;

  /** Long enough for a browser to open the socket it asked for, and no longer. */
  static constexpr std::chrono::seconds TTL{30};

  explicit WsTickets(std::function<Clock::time_point()> now = [] { return Clock::now(); })
    : m_now(std::move(now))
  {
  }

  /** A ticket for `holder`, good for one socket within TTL; empty when no
   *  secure randomness is to be had. */
  std::string mint(Holder holder)
  {
    unsigned char raw[32];
    if (RAND_bytes(raw, sizeof(raw)) != 1)
    {
      return "";
    }
    static constexpr char hex[] = "0123456789abcdef";
    std::string ticket;
    ticket.reserve(sizeof(raw) * 2);
    for (const auto byte : raw)
    {
      ticket.push_back(hex[byte >> 4]);
      ticket.push_back(hex[byte & 0x0f]);
    }
    std::lock_guard lock(m_mutex);
    prune();
    while (m_tickets.size() >= MAX_OUTSTANDING && !m_order.empty())
    {
      m_tickets.erase(m_order.front());
      m_order.pop_front();
    }
    m_tickets.emplace(ticket, Held{std::move(holder), m_now() + TTL});
    m_order.push_back(ticket);
    return ticket;
  }

  /** Who a ticket was minted for — once. Unknown, used or expired: nothing. */
  std::optional<Holder> redeem(const std::string& ticket)
  {
    std::lock_guard lock(m_mutex);
    const auto it = m_tickets.find(ticket);
    if (it == m_tickets.end())
    {
      return std::nullopt;
    }
    Held held = std::move(it->second);
    m_tickets.erase(it);
    if (held.expires < m_now())
    {
      return std::nullopt;
    }
    return std::move(held.holder);
  }

private:
  /** Outstanding tickets kept; past this the oldest go first. */
  static constexpr std::size_t MAX_OUTSTANDING = 10000;

  struct Held
  {
    Holder holder;
    Clock::time_point expires;
  };

  void prune()
  {
    const auto now = m_now();
    while (!m_order.empty())
    {
      const auto it = m_tickets.find(m_order.front());
      if (it != m_tickets.end() && it->second.expires >= now)
      {
        break;
      }
      if (it != m_tickets.end())
      {
        m_tickets.erase(it);
      }
      m_order.pop_front();
    }
  }

  std::function<Clock::time_point()> m_now;
  std::mutex m_mutex;
  std::map<std::string, Held> m_tickets;
  std::deque<std::string> m_order; // minting order, oldest first
};

} // namespace hkp
