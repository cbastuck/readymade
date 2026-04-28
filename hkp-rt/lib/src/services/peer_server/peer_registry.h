#pragma once

#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace hkp {

class PeerWsSession;

class PeerRegistry
{
public:
  using tEventCallback = std::function<void(const std::string& event,
                                            const std::string& peerId,
                                            const std::vector<std::string>& connectedPeers)>;

  std::string generateId();

  // Returns false if the ID is already taken.
  bool registerPeer(const std::string& id, std::shared_ptr<PeerWsSession> session);
  void unregisterPeer(const std::string& id);

  // Looks up dst and calls send() on its session. Returns false if dst is unknown.
  bool route(const std::string& dstId, const std::string& msg);

  std::vector<std::string> connectedPeerIds() const;

  void setEventCallback(tEventCallback cb) { m_eventCallback = std::move(cb); }

private:
  // Must be called with m_mutex held.
  std::vector<std::string> connectedPeerIdsLocked() const;

  mutable std::mutex m_mutex;
  std::unordered_map<std::string, std::weak_ptr<PeerWsSession>> m_peers;
  tEventCallback m_eventCallback;
};

} // namespace hkp
