#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <vector>

namespace hkp {

// One piece of a stream, shared by every listener it is handed to rather than
// copied for each.
using StreamChunk = std::shared_ptr<const std::vector<uint8_t>>;

// Whoever a StreamBroadcast writes to.
class StreamListener
{
public:
  virtual ~StreamListener() = default;

  // Hands over one chunk. Must return at once: it is called by whoever
  // produced the chunk, and one listener's connection must never hold up the
  // stream or the others.
  virtual void deliver(const StreamChunk& chunk) = 0;

  // Ends this listener's stream. Called once the listener has left, from any
  // thread.
  virtual void close() = 0;
};

// The chunks waiting to be written to one listener.
//
// Bounded, because a listener whose connection is slower than the stream would
// otherwise fall further behind for as long as it stays connected — the gap
// between what it hears and what is live grows without limit. Past the bound
// the oldest waiting chunks are dropped: the listener hears a gap and lands
// back near the live edge. The chunk being written is never dropped, and
// neither is the newest, so a chunk larger than the bound still goes out.
class ChunkQueue
{
public:
  explicit ChunkQueue(std::size_t maxBytes) : m_maxBytes(maxBytes) {}

  // Answers how many chunks were dropped to make room.
  std::size_t push(StreamChunk chunk)
  {
    m_bytes += chunk->size();
    m_chunks.push_back(std::move(chunk));

    std::size_t dropped = 0;
    const std::size_t firstDroppable = m_writing ? 1 : 0;
    while (m_bytes > m_maxBytes && m_chunks.size() > firstDroppable + 1)
    {
      auto oldest = m_chunks.begin() + firstDroppable;
      m_bytes -= (*oldest)->size();
      m_chunks.erase(oldest);
      ++dropped;
    }
    return dropped;
  }

  // The chunk to write next, now marked as being written — or null when there
  // is none, or one is already being written.
  StreamChunk beginWrite()
  {
    if (m_writing || m_chunks.empty())
    {
      return nullptr;
    }
    m_writing = true;
    return m_chunks.front();
  }

  // The chunk beginWrite() handed out has been written.
  void endWrite()
  {
    if (!m_writing)
    {
      return;
    }
    m_writing = false;
    m_bytes -= m_chunks.front()->size();
    m_chunks.pop_front();
  }

  bool writing() const { return m_writing; }
  std::size_t bytes() const { return m_bytes; }
  std::size_t size() const { return m_chunks.size(); }

private:
  std::size_t m_maxBytes;
  std::size_t m_bytes = 0;
  bool m_writing = false;
  std::deque<StreamChunk> m_chunks;
};

// One stream, written to everyone listening.
//
// Every listener gets the same chunks in the same order; there is no stream
// per listener. A listener that joins late starts with the burst — the most
// recent chunks, whole, up to `burstBytes` — so a player has something to
// buffer at once instead of waiting for enough of the stream to arrive. The
// burst is the only history kept: 0 keeps none, and a newcomer starts at the
// next chunk.
//
// Chunks are the unit throughout — kept, replayed and dropped whole — so a
// stream whose chunks each start at a point a decoder can start from (whole
// MP3 frames) stays decodable for everyone.
//
// Thread-safe: chunks are published from the pipeline's thread while
// listeners come and go on the server's.
class StreamBroadcast
{
public:
  void setBurstBytes(std::size_t bytes)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_burstBytes = bytes;
    trimBurst();
  }

  // Called with the listener count whenever it changes, outside the lock.
  void onListenersChanged(std::function<void(std::size_t)> callback)
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_onListenersChanged = std::move(callback);
  }

  void join(std::shared_ptr<StreamListener> listener)
  {
    std::function<void(std::size_t)> changed;
    std::size_t count = 0;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      // Under the lock, like publish(), so nothing published meanwhile can
      // reach this listener ahead of the older chunks in the burst.
      for (const auto& chunk : m_burst)
      {
        listener->deliver(chunk);
      }
      m_listeners.push_back(std::move(listener));
      count = m_listeners.size();
      changed = m_onListenersChanged;
    }
    if (changed)
    {
      changed(count);
    }
  }

  void leave(const StreamListener* listener)
  {
    std::shared_ptr<StreamListener> removed;
    std::function<void(std::size_t)> changed;
    std::size_t count = 0;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      auto it = std::find_if(m_listeners.begin(), m_listeners.end(),
                             [listener](const auto& entry) { return entry.get() == listener; });
      if (it == m_listeners.end())
      {
        return;
      }
      removed = std::move(*it);
      m_listeners.erase(it);
      count = m_listeners.size();
      changed = m_onListenersChanged;
    }
    if (changed)
    {
      changed(count);
    }
  }

  void publish(StreamChunk chunk)
  {
    if (!chunk || chunk->empty())
    {
      return;
    }
    std::lock_guard<std::mutex> lock(m_mutex);
    if (m_burstBytes > 0)
    {
      m_burst.push_back(chunk);
      m_burstHeld += chunk->size();
      trimBurst();
    }
    for (const auto& listener : m_listeners)
    {
      listener->deliver(chunk);
    }
  }

  // Ends every listener's stream and forgets the burst.
  void closeAll()
  {
    std::vector<std::shared_ptr<StreamListener>> listeners;
    std::function<void(std::size_t)> changed;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      listeners.swap(m_listeners);
      m_burst.clear();
      m_burstHeld = 0;
      changed = m_onListenersChanged;
    }
    for (const auto& listener : listeners)
    {
      listener->close();
    }
    if (changed && !listeners.empty())
    {
      changed(0);
    }
  }

  std::size_t listenerCount() const
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_listeners.size();
  }

  // Who is listening right now.
  std::vector<std::shared_ptr<StreamListener>> listeners() const
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_listeners;
  }

private:
  void trimBurst()
  {
    while (!m_burst.empty() && m_burstHeld > m_burstBytes)
    {
      m_burstHeld -= m_burst.front()->size();
      m_burst.pop_front();
    }
  }

  mutable std::mutex m_mutex;
  std::vector<std::shared_ptr<StreamListener>> m_listeners;
  std::deque<StreamChunk> m_burst;
  std::size_t m_burstHeld = 0;
  std::size_t m_burstBytes = 0;
  std::function<void(std::size_t)> m_onListenersChanged;
};

} // namespace hkp
