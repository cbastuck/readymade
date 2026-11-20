#pragma once

#include <atomic>
#include <chrono>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

#include <types/types.h>
#include <types/data.h>

/**
 * What the Matrix services share: how to talk to a homeserver's
 * Client-Server API, and how to read and write what it says.
 *
 * Matrix is HTTPS and JSON, so this is a small client rather than an SDK.
 * It covers what `matrix-listener` and `matrix-sender` need — who am I, sync,
 * resolve a room alias, send a message — and nothing about end-to-end
 * encryption: an encrypted room is reported as one, never read.
 *
 * Everything that is not the request itself is a free function over JSON, so
 * the shape of a sync answer or a sent message can be checked without a
 * homeserver (tests/service_matrix.test.cpp).
 */
namespace hkp {
namespace matrix {

/** Where a homeserver's client API is, read from what a board writes. */
struct Homeserver
{
  bool secure = true;
  std::string host;
  std::string port;
  // Anything before `/_matrix`, for a server behind a path prefix. No
  // trailing slash; usually empty.
  std::string basePath;
};

/** `https://matrix.example.org` → its parts, or nothing and why. */
std::optional<Homeserver> parseHomeserver(const std::string& url, std::string& problem);

struct Response
{
  int status = 0;
  // The answer as JSON, or null when it was not JSON.
  json body;
};

/**
 * What a homeserver said when it refused: `M_FORBIDDEN: You are not in this
 * room`, or the status when the answer carried no Matrix error.
 */
std::string describeError(const Response& response);

/** How long a 429 asks to wait, from its `retry_after_ms`. */
std::chrono::milliseconds retryAfter(const Response& response,
                                     std::chrono::milliseconds fallback);

/** Thrown out of a request that was cancelled while it was waiting. */
struct Cancelled : std::runtime_error
{
  Cancelled() : std::runtime_error("cancelled") {}
};

/**
 * Requests to a homeserver, one at a time, on the calling thread.
 *
 * A request may wait a long time — a sync is held open by the server until
 * something happens — so `cancel()`, from any thread, ends the one in flight
 * and every one after it with `Cancelled`. That is what lets a listener stop
 * without waiting out its long-poll. A cancelled connection stays cancelled;
 * make a new one to start again.
 *
 * The destination is resolved through the egress guard, and over TLS the
 * certificate is checked against the host name: what is sent is an access
 * token.
 */
class Connection
{
public:
  Connection();
  ~Connection();

  Connection(const Connection&) = delete;
  Connection& operator=(const Connection&) = delete;

  Response request(const Homeserver& server,
                   const std::string& method,
                   const std::string& target,
                   const std::string& accessToken,
                   const json* body,
                   std::chrono::milliseconds timeout);

  void cancel();

private:
  struct Impl;
  std::unique_ptr<Impl> m_impl;
};

// ── Addresses ────────────────────────────────────────────────────────────────

/** Percent-encodes everything but the unreserved characters. */
std::string encodeComponent(const std::string& text);

std::string whoamiTarget(const Homeserver& server);

/** `#room:server` → the request that answers its room id. */
std::string aliasTarget(const Homeserver& server, const std::string& alias);

/**
 * A sync, filtered down to messages in `rooms` (every joined room when
 * empty). Without `since` it is the first sync, which asks for as little as
 * possible: it is made for its `next_batch`, so that only what is said after
 * the listener connected is passed on.
 */
std::string syncTarget(const Homeserver& server,
                       const std::string& since,
                       const std::vector<std::string>& rooms,
                       int timeoutMs);

std::string sendTarget(const Homeserver& server,
                       const std::string& roomId,
                       const std::string& txnId);

/** Whether a room is named by its alias (`#room:server`) rather than its id. */
inline bool isRoomAlias(const std::string& room)
{
  return !room.empty() && room.front() == '#';
}

// ── What a sync says ─────────────────────────────────────────────────────────

struct SyncResult
{
  std::string nextBatch;
  // One object per message, oldest first — what the listener passes on.
  json messages = json::array();
  // Rooms that sent an encrypted event, which this client cannot read.
  std::vector<std::string> encryptedRooms;
};

/**
 * The messages in a sync answer, as the listener passes them on:
 * `{ text, msgtype, sender, roomId, eventId, timestamp, date, content }`, and
 * `replaces` for an edit, whose `text` is the new one. Messages from
 * `ownUserId` are left out unless `includeOwn`.
 */
SyncResult readSync(const json& body,
                    const std::vector<std::string>& rooms,
                    const std::string& ownUserId,
                    bool includeOwn);

/** Milliseconds since the epoch as `2026-11-19T08:30:00.000Z`. */
std::string isoDate(long long epochMs);

// ── What is sent ─────────────────────────────────────────────────────────────

struct OutgoingMessage
{
  json content;
  // A room the input named, to send to instead of the configured one.
  std::string roomId;
};

/**
 * The `m.room.message` content for an input: a string is the message; an
 * object says `text` (or `body`), and may say `msgtype`, `html` and `roomId`;
 * anything else is sent as its JSON. Nothing to send answers nothing.
 */
std::optional<OutgoingMessage> outgoingMessage(const Data& input,
                                               const std::string& defaultMsgtype);

} // namespace matrix
} // namespace hkp
