#pragma once

#include <array>
#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "../../common/stream_broadcast.h"

namespace hkp {

class Session;

// Answers a bounded Range request on a live stream — WebKit asks for
// `bytes=0-1` before it plays anything, to learn what the resource is — with
// that many bytes from the start of `sample`, and closes. A live stream has no
// byte 0 to return, so this is an answer to the question being asked (what
// does it start with, and are ranges understood) rather than a position; the
// total length is given as unknown. Answered with the endless stream instead,
// the probe stays open for as long as the player does and counts as a second
// listener.
void answerRangeProbe(const std::shared_ptr<Session>& session, const std::string& contentType,
                      std::uint64_t first, std::uint64_t last, const std::vector<uint8_t>& sample);

// The bounds of a `bytes=first-last` Range header, or nothing where it is
// absent, open-ended or not of that form.
std::optional<std::pair<std::uint64_t, std::uint64_t>> boundedRange(const std::string& header);

// One caller listening to an endpoint's stream.
//
// Takes over the caller's connection once its request has been read: sends a
// response head with no length, then every chunk it is handed, for as long as
// the caller stays connected. `Connection: close` rather than chunked encoding,
// so the body is just the stream and ends when the connection does — which is
// what every player, however old, understands.
//
// Everything that touches the connection runs on its strand, and every write is
// asynchronous: deliver() only queues, so the thread publishing the stream is
// never held up by a listener. What a listener cannot take fast enough is
// dropped from its own queue (see ChunkQueue), never from anyone else's.
//
// A caller that stops reading without hanging up — a paused player, a request
// a browser parked rather than closed — is not listening, however long its
// connection stays open. Once a write has been waiting longer than the stall
// timeout the listener is let go, so the count says who is actually hearing
// the stream.
class HttpStreamListener : public StreamListener,
                           public std::enable_shared_from_this<HttpStreamListener>
{
public:
  // `onClosed` runs once, on the connection's strand, when the stream ends for
  // any reason — the caller hanging up, a failed write, close().
  HttpStreamListener(std::shared_ptr<Session> session, std::size_t maxQueueBytes,
                     std::chrono::milliseconds stallTimeout,
                     std::function<void(HttpStreamListener*)> onClosed);

  // Sends the response head. Call on the connection's strand, before the
  // listener joins a broadcast.
  void start(const std::string& contentType);

  void deliver(const StreamChunk& chunk) override;
  // Safe from any thread.
  void close() override;

  // How many chunks this listener missed because it fell behind.
  std::size_t droppedChunks() const { return m_dropped; }

  // Who this is and how it is doing, for the endpoint's state. Safe from any
  // thread: what it reads is either fixed at start() or atomic.
  nlohmann::json describe() const;

private:
  void pump();
  void watchForHangUp();
  void finish();

  std::shared_ptr<Session> m_session;
  ChunkQueue m_queue;
  std::function<void(HttpStreamListener*)> m_onClosed;
  std::string m_head;
  bool m_headSent = false;
  bool m_headWriting = false;
  bool m_closed = false;
  std::chrono::milliseconds m_stallTimeout;
  // When the write in progress began; meaningful only while one is.
  std::chrono::steady_clock::time_point m_writeStartedAt;
  std::atomic<std::size_t> m_dropped{0};
  std::atomic<std::uint64_t> m_bytesSent{0};
  // Fixed at start(), before the listener joins anything.
  std::string m_address;
  std::string m_userAgent;
  std::string m_range;
  std::chrono::steady_clock::time_point m_connectedAt;
  std::array<char, 256> m_readBuffer{};
};

} // namespace hkp
