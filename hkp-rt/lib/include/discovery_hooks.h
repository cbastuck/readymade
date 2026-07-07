#pragma once

#include <functional>

namespace hkp
{

// Optional process-wide hooks invoked around an active LAN-discovery window.
//
// Android needs to hold a WifiManager multicast lock while browsing/advertising
// (the kernel filters multicast otherwise); it registers hooks that acquire the
// lock on window start and release it on window end. Desktop/iOS leave these
// unset, so both callbacks are no-ops.
//
// This lives in a public header (rather than the private discovery.h) so host
// integration layers — e.g. the Android JNI shim — can register hooks without
// depending on the runtime's internal discovery headers.
//
// `onWindowStart` runs once the discover sockets are open; `onWindowStop` runs
// when the window closes (normal expiry or explicit stop).
struct DiscoveryPlatformHooks
{
  std::function<void()> onWindowStart;
  std::function<void()> onWindowStop;
};

void setDiscoveryPlatformHooks(DiscoveryPlatformHooks hooks);

}  // namespace hkp
