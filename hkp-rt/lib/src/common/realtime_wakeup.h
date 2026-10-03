#pragma once

#include <atomic>
#include <functional>
#include <thread>

#if defined(__APPLE__)
#include <dispatch/dispatch.h>
#else
#include <semaphore>
#endif

namespace hkp {

// Lets a realtime thread ask for work to be done on another thread without
// paying for the asking.
//
// signal() is the only call the realtime thread makes: an atomic exchange and,
// when nothing is pending yet, a semaphore signal. No allocation, no lock, no
// logging. Everything that may allocate or block — posting onto an event loop,
// running a pipeline — happens on the thread this object owns, which calls
// `onWake` once per wake-up.
//
// Wake-ups coalesce: signals arriving while one is pending are the same
// wake-up. That loses nothing when the data travels separately, e.g. a ring
// buffer the realtime thread keeps writing into, because the woken side reads
// whatever has accumulated rather than one signal's worth. A wake-up stays
// pending until the side doing the work calls acknowledge(), so however long
// the work takes to be scheduled, the realtime thread signals at most once.
class RealtimeWakeup
{
public:
  explicit RealtimeWakeup(std::function<void()> onWake)
    : m_onWake(std::move(onWake))
#if defined(__APPLE__)
    , m_semaphore(dispatch_semaphore_create(0))
#endif
  {
    m_thread = std::thread([this]() { run(); });
  }

  ~RealtimeWakeup()
  {
    m_stopping.store(true, std::memory_order_release);
    wake();
    if (m_thread.joinable())
    {
      m_thread.join();
    }
#if defined(__APPLE__)
    dispatch_release(m_semaphore);
#endif
  }

  RealtimeWakeup(const RealtimeWakeup&) = delete;
  RealtimeWakeup& operator=(const RealtimeWakeup&) = delete;

  // Realtime-safe.
  void signal() noexcept
  {
    if (!m_pending.exchange(true, std::memory_order_acq_rel))
    {
      wake();
    }
  }

  // Called by the side doing the work, before it reads, so that a signal
  // arriving while it reads is a new wake-up rather than one already handled.
  void acknowledge() noexcept
  {
    m_pending.store(false, std::memory_order_release);
  }

  // How many wake-ups were handed to `onWake` — for tests and state.
  unsigned long long wakeCount() const noexcept
  {
    return m_wakeCount.load(std::memory_order_relaxed);
  }

private:
  void wake() noexcept
  {
#if defined(__APPLE__)
    dispatch_semaphore_signal(m_semaphore);
#else
    m_semaphore.release();
#endif
  }

  void run()
  {
    for (;;)
    {
#if defined(__APPLE__)
      dispatch_semaphore_wait(m_semaphore, DISPATCH_TIME_FOREVER);
#else
      m_semaphore.acquire();
#endif
      if (m_stopping.load(std::memory_order_acquire))
      {
        return;
      }
      m_wakeCount.fetch_add(1, std::memory_order_relaxed);
      m_onWake();
    }
  }

  std::function<void()> m_onWake;
  std::atomic<bool> m_pending{false};
  std::atomic<bool> m_stopping{false};
  std::atomic<unsigned long long> m_wakeCount{0};
#if defined(__APPLE__)
  dispatch_semaphore_t m_semaphore;
#else
  std::counting_semaphore<> m_semaphore{0};
#endif
  std::thread m_thread;
};

} // namespace hkp
