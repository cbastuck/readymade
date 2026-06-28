#pragma once

#include <atomic>
#include <cstdint>
#include <map>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <nlohmann/json.hpp>

namespace hkp
{

// A Meander instance found on the local network during a discover window.
struct DiscoveredPeer
{
  std::string id;        // stable per-instance UUID (from the TXT record)
  std::string name;      // friendly display name
  std::string platform;  // "macos" | "windows" | "linux" | "ios"
  std::string host;      // resolved IPv4 address of the peer
  unsigned int port = 0; // runtime HTTP port (from the SRV record)
  std::string board;     // currently loaded board name, if advertised
};

void to_json(nlohmann::json& j, const DiscoveredPeer& p);

// "macos" | "windows" | "linux" | "ios" | "unknown" for this build.
const char* discoveryPlatformName();

// A friendly name for this machine (hostname / computer name), used as the
// default display name a peer shows for this instance.
std::string discoveryDeviceName();

// Transient, symmetric LAN discovery over mDNS.
//
// Discovery is NOT always-on.  A discover "window" is opened on demand; while it
// is active the instance periodically announces itself (if `advertise` is true)
// and listens for other instances doing the same.  All instances whose windows
// overlap see each other.  When the window elapses the socket is closed and no
// resources are spent.  Connecting to a discovered peer afterwards still relies
// on that peer's HTTP server being LAN-reachable (bound to 0.0.0.0).
class DiscoveryManager
{
public:
  struct Identity
  {
    std::string id;
    std::string name;
    std::string platform;
    unsigned int port = 0;
    std::string board;
  };

  DiscoveryManager();
  ~DiscoveryManager();

  DiscoveryManager(const DiscoveryManager&) = delete;
  DiscoveryManager& operator=(const DiscoveryManager&) = delete;

  // (Re)start a discover window for `durationSeconds`.  When `advertise` is true
  // the instance announces itself; otherwise it only browses for peers.
  void start(const Identity& self, bool advertise, int durationSeconds);
  void stop();

  bool isActive() const { return m_active.load(); }
  int64_t endsAtEpochMs() const { return m_endsAtMs.load(); } // 0 when inactive
  std::vector<DiscoveredPeer> peers() const;

private:
  void run(Identity self, bool advertise, int durationSeconds);

  mutable std::mutex m_mutex;
  std::map<std::string, DiscoveredPeer> m_peers; // keyed by peer id
  std::thread m_thread;
  std::atomic<bool> m_active{false};
  std::atomic<bool> m_stop{false};
  std::atomic<int64_t> m_endsAtMs{0};
};

}
