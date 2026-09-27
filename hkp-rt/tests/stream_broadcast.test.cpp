#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <thread>

#include <types/data.h>

#include "common/realtime_wakeup.h"
#include "common/stream_broadcast.h"

using namespace hkp;

namespace {

StreamChunk chunk(std::initializer_list<uint8_t> bytes)
{
  return std::make_shared<const std::vector<uint8_t>>(bytes);
}

StreamChunk chunkOfSize(std::size_t size, uint8_t fill)
{
  return std::make_shared<const std::vector<uint8_t>>(size, fill);
}

// Keeps what it is handed, in order.
class RecordingListener : public StreamListener
{
public:
  void deliver(const StreamChunk& c) override { received.push_back(c); }
  void close() override { closed = true; }

  std::vector<StreamChunk> received;
  bool closed = false;
};

template <typename Predicate>
bool eventually(Predicate predicate)
{
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(2);
  while (std::chrono::steady_clock::now() < deadline)
  {
    if (predicate())
    {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
  return predicate();
}

} // namespace

// ──────────────────────────────────────────────────────────────────────────────
// One listener's queue: bounded, and what it drops is the oldest it has not
// started writing.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a queue within its bound keeps everything", "[stream][queue]")
{
  ChunkQueue queue(10);
  REQUIRE(queue.push(chunkOfSize(4, 1)) == 0);
  REQUIRE(queue.push(chunkOfSize(4, 2)) == 0);
  REQUIRE(queue.size() == 2);
  REQUIRE(queue.bytes() == 8);
}

TEST_CASE("a listener falling behind loses its oldest chunks, not its newest",
          "[stream][queue]")
{
  ChunkQueue queue(10);
  queue.push(chunkOfSize(4, 1));
  queue.push(chunkOfSize(4, 2));
  REQUIRE(queue.push(chunkOfSize(4, 3)) == 1);

  REQUIRE(queue.size() == 2);
  auto next = queue.beginWrite();
  REQUIRE((*next)[0] == 2);
}

TEST_CASE("the chunk being written is never dropped", "[stream][queue]")
{
  ChunkQueue queue(10);
  queue.push(chunkOfSize(4, 1));
  auto writing = queue.beginWrite();
  queue.push(chunkOfSize(4, 2));
  queue.push(chunkOfSize(4, 3)); // over the bound: 2 goes, 1 is on the wire

  queue.endWrite();
  auto next = queue.beginWrite();
  REQUIRE((*next)[0] == 3);
}

TEST_CASE("a chunk larger than the bound still goes out", "[stream][queue]")
{
  ChunkQueue queue(10);
  queue.push(chunkOfSize(4, 1));
  queue.push(chunkOfSize(32, 2));

  REQUIRE(queue.size() == 1);
  REQUIRE((*queue.beginWrite())[0] == 2);
}

TEST_CASE("only one chunk is written at a time", "[stream][queue]")
{
  ChunkQueue queue(100);
  queue.push(chunk({1}));
  queue.push(chunk({2}));
  REQUIRE(queue.beginWrite() != nullptr);
  REQUIRE(queue.beginWrite() == nullptr);
  queue.endWrite();
  REQUIRE((*queue.beginWrite())[0] == 2);
}

// ──────────────────────────────────────────────────────────────────────────────
// The broadcast: one stream, the same for everyone.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("every listener gets the same chunks, in order", "[stream][broadcast]")
{
  StreamBroadcast broadcast;
  auto a = std::make_shared<RecordingListener>();
  auto b = std::make_shared<RecordingListener>();
  broadcast.join(a);
  broadcast.join(b);

  auto first = chunk({1});
  auto second = chunk({2});
  broadcast.publish(first);
  broadcast.publish(second);

  REQUIRE(a->received == std::vector<StreamChunk>{first, second});
  // Shared, not copied per listener.
  REQUIRE(b->received == a->received);
}

TEST_CASE("a listener that joins late starts at the next chunk", "[stream][broadcast]")
{
  StreamBroadcast broadcast;
  broadcast.publish(chunk({1}));

  auto late = std::make_shared<RecordingListener>();
  broadcast.join(late);
  REQUIRE(late->received.empty());

  broadcast.publish(chunk({2}));
  REQUIRE(late->received.size() == 1);
}

TEST_CASE("the burst replays the most recent whole chunks to a newcomer",
          "[stream][broadcast]")
{
  StreamBroadcast broadcast;
  broadcast.setBurstBytes(8);
  broadcast.publish(chunkOfSize(4, 1));
  broadcast.publish(chunkOfSize(4, 2));
  broadcast.publish(chunkOfSize(4, 3));

  auto newcomer = std::make_shared<RecordingListener>();
  broadcast.join(newcomer);

  // Whole chunks only, newest last: never a chunk cut to fit.
  REQUIRE(newcomer->received.size() == 2);
  REQUIRE((*newcomer->received[0])[0] == 2);
  REQUIRE((*newcomer->received[1])[0] == 3);
}

TEST_CASE("a listener that left hears nothing more", "[stream][broadcast]")
{
  StreamBroadcast broadcast;
  auto listener = std::make_shared<RecordingListener>();
  broadcast.join(listener);
  broadcast.leave(listener.get());
  broadcast.publish(chunk({1}));

  REQUIRE(listener->received.empty());
  REQUIRE(broadcast.listenerCount() == 0);
}

TEST_CASE("the listener count is reported as it changes", "[stream][broadcast]")
{
  StreamBroadcast broadcast;
  std::vector<std::size_t> counts;
  broadcast.onListenersChanged([&](std::size_t n) { counts.push_back(n); });

  auto a = std::make_shared<RecordingListener>();
  auto b = std::make_shared<RecordingListener>();
  broadcast.join(a);
  broadcast.join(b);
  broadcast.leave(a.get());
  broadcast.closeAll();

  REQUIRE(counts == std::vector<std::size_t>{1, 2, 1, 0});
  REQUIRE(b->closed);
}

TEST_CASE("nothing empty is streamed", "[stream][broadcast]")
{
  StreamBroadcast broadcast;
  auto listener = std::make_shared<RecordingListener>();
  broadcast.join(listener);
  broadcast.publish(std::make_shared<const std::vector<uint8_t>>());
  broadcast.publish(nullptr);
  REQUIRE(listener->received.empty());
}

// ──────────────────────────────────────────────────────────────────────────────
// The realtime handoff: a realtime thread signals, another thread works, and
// signals arriving before the work is picked up are one wake-up.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("signals before the work is acknowledged are one wake-up",
          "[realtime][wakeup]")
{
  std::atomic<int> woken{0};
  RealtimeWakeup wakeup([&]() { ++woken; });

  for (int i = 0; i < 1000; ++i)
  {
    wakeup.signal();
  }
  REQUIRE(eventually([&]() { return woken.load() == 1; }));
  std::this_thread::sleep_for(std::chrono::milliseconds(20));
  REQUIRE(woken.load() == 1);

  // The side doing the work picked it up: the next signal is a new wake-up.
  wakeup.acknowledge();
  wakeup.signal();
  REQUIRE(eventually([&]() { return woken.load() == 2; }));
}

TEST_CASE("a wakeup stops cleanly with nothing pending", "[realtime][wakeup]")
{
  { RealtimeWakeup wakeup([]() {}); }
  SUCCEED("destructor joined an idle worker");
}

// ──────────────────────────────────────────────────────────────────────────────
// The ring buffer between the two: what the reader sees behind the write index
// is what the writer put there.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a reader on another thread sees every sample, in order",
          "[realtime][ringbuffer]")
{
  auto buffer = std::make_shared<FloatRingBuffer>("handoff");
  constexpr int kBlocks = 2000;
  constexpr int kBlock = 256;

  std::thread writer([&]() {
    float block[kBlock];
    int next = 0;
    for (int b = 0; b < kBlocks; ++b)
    {
      for (int i = 0; i < kBlock; ++i)
      {
        block[i] = static_cast<float>(next++ % 100000);
      }
      // Keep within the buffer, as a device does by being slower than the
      // reader: what is under test is ordering, not overrun.
      while (buffer->availableCount() > buffer->getInternalBufferSize() / 2)
      {
        std::this_thread::yield();
      }
      buffer->appendBinary(reinterpret_cast<const char*>(block), sizeof(block));
    }
  });

  std::vector<float> read;
  int expected = 0;
  bool inOrder = true;
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(20);
  while (expected < kBlocks * kBlock && std::chrono::steady_clock::now() < deadline)
  {
    buffer->consumeAvailable(read, true);
    for (float value : read)
    {
      inOrder = inOrder && value == static_cast<float>(expected % 100000);
      ++expected;
    }
  }
  writer.join();

  REQUIRE(expected == kBlocks * kBlock);
  REQUIRE(inOrder);
  REQUIRE(buffer->availableCount() == 0);
}
