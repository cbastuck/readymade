#pragma once

#include <memory>
#include <string>

#include <service.h>
#include <types/types.h>

#include "peer_registry.h"
#include "peer_server_listener.h"

namespace hkp {

/**
 * Service Documentation
 * Service ID: peer-server
 * Service Name: PeerServerService
 * Runtime: hkp-rt
 * Description: PeerJS-compatible signaling server (HTTP + WebSocket on one port).
 *   Browsers connect via the PeerJS client library to exchange WebRTC
 *   offer/answer/candidate messages without hkp-node being available.
 * Key Config:
 *   port        (number,  default 0)         — 0 = OS-assigned
 *   path        (string,  default "/peerjs") — base URL path
 *   emitEvents  (boolean, default false)     — push peer-connected/disconnected
 *                                              events downstream
 * State:
 *   port           — actual bound port
 *   path           — configured path
 *   emitEvents     — current flag value
 *   connectedPeers — list of currently-connected peer IDs
 */
class PeerServerService : public Service
{
public:
  static std::string serviceId() { return "peer-server"; }

  PeerServerService(const std::string& instanceId)
    : Service(instanceId, "peer-server")
  {
  }

  ~PeerServerService()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_port, (*buf)["port"]);
      updateIfNeeded(m_path, (*buf)["path"]);
      updateIfNeeded(m_emitEvents, (*buf)["emitEvents"]);
    }
    return Service::configure(data);
  }

  json getState() const override
  {
    json state;
    state["port"]           = m_listener ? static_cast<int>(m_listener->getBoundPort()) : static_cast<int>(m_port);
    state["path"]           = m_path;
    state["emitEvents"]     = m_emitEvents;
    state["connectedPeers"] = m_registry ? m_registry->connectedPeerIds() : std::vector<std::string>{};
    mergeBypassState(state);
    return state;
  }

  Data process(Data data) override
  {
    // Passthrough — events are pushed via emit() from the registry callback.
    return data;
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      stop();
    }
    else
    {
      start();
    }
    return bypass;
  }

private:
  void start()
  {
    if (m_listener)
    {
      stop();
    }

    m_registry = std::make_shared<PeerRegistry>();

    if (m_emitEvents)
    {
      m_registry->setEventCallback(
        [this](const std::string& event,
               const std::string& peerId,
               const std::vector<std::string>& connectedPeers)
        {
          json j;
          j["event"]          = event;
          j["peerId"]         = peerId;
          j["connectedPeers"] = connectedPeers;
          emit(j);
        });
    }

    m_listener = std::make_unique<PeerServerListener>(m_registry, m_port, m_path);
  }

  void stop()
  {
    m_listener.reset();
    m_registry.reset();
  }

  unsigned short m_port     = 0;
  std::string    m_path     = "/peerjs";
  bool           m_emitEvents = false;

  std::shared_ptr<PeerRegistry>       m_registry;
  std::unique_ptr<PeerServerListener> m_listener;
};

} // namespace hkp
