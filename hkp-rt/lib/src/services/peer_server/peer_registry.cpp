#include "peer_registry.h"

#include "peer_ws_session.h"

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>

namespace hkp {

std::string PeerRegistry::generateId()
{
  boost::uuids::random_generator gen;
  return boost::uuids::to_string(gen());
}

bool PeerRegistry::registerPeer(const std::string& id, std::shared_ptr<PeerWsSession> session)
{
  std::vector<std::string> peers;
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    auto [it, inserted] = m_peers.emplace(id, session);
    if (!inserted)
    {
      return false;
    }
    peers = connectedPeerIdsLocked();
  }
  if (m_eventCallback)
  {
    m_eventCallback("peer-connected", id, peers);
  }
  return true;
}

void PeerRegistry::unregisterPeer(const std::string& id)
{
  std::vector<std::string> peers;
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_peers.erase(id);
    peers = connectedPeerIdsLocked();
  }
  if (m_eventCallback)
  {
    m_eventCallback("peer-disconnected", id, peers);
  }
}

bool PeerRegistry::route(const std::string& dstId, const std::string& msg)
{
  std::shared_ptr<PeerWsSession> session;
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    auto it = m_peers.find(dstId);
    if (it == m_peers.end())
    {
      return false;
    }
    session = it->second.lock();
    if (!session)
    {
      m_peers.erase(it);
      return false;
    }
  }
  session->send(msg);
  return true;
}

std::vector<std::string> PeerRegistry::connectedPeerIds() const
{
  std::lock_guard<std::mutex> lock(m_mutex);
  return connectedPeerIdsLocked();
}

std::vector<std::string> PeerRegistry::connectedPeerIdsLocked() const
{
  std::vector<std::string> ids;
  ids.reserve(m_peers.size());
  for (const auto& [id, _] : m_peers)
  {
    ids.push_back(id);
  }
  return ids;
}

} // namespace hkp
