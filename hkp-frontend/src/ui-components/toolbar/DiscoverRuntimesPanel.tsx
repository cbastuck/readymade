import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Lock, Monitor, Plus, RefreshCw, Search, Smartphone } from "lucide-react";

import {
  SettingsButton,
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "hkp-frontend/src/ui-components/settings/kit";
import { RuntimeClass } from "hkp-frontend/src/types";
import {
  type DiscoveredPeer,
  getDiscoverState,
  isDiscoverySupported,
  peerToRuntimeClass,
  startDiscover,
  stopDiscover,
} from "hkp-frontend/src/runtime/discovery/DiscoveryApi";
import { usePeerAuthorization } from "hkp-frontend/src/runtime/discovery/usePeerAuthorization";

type Props = {
  existing: Array<RuntimeClass>;
  onAdd: (rt: RuntimeClass) => void;
};

// Symmetric LAN discovery: this device must be in discover mode at the same time
// as the peers it wants to find, so both advertise and browse during the window.
export default function DiscoverRuntimesPanel({ existing, onAdd }: Props) {
  const supported = isDiscoverySupported();

  const [discovering, setDiscovering] = useState(false);
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const authByPeer = usePeerAuthorization(peers);
  const [endsAt, setEndsAt] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const stopTimers = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const beginDiscover = useCallback(async () => {
    try {
      const state = await startDiscover(30);
      startedRef.current = true;
      setPeers(state.peers);
      setEndsAt(state.endsAt);
      setNowMs(Date.now());
      setDiscovering(true);
      stopTimers();
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await getDiscoverState();
          setPeers(s.peers);
          setEndsAt(s.endsAt);
          if (!s.active) {
            setDiscovering(false);
            stopTimers();
          }
        } catch {
          /* transient; keep polling */
        }
      }, 1500);
      tickRef.current = window.setInterval(() => setNowMs(Date.now()), 500);
    } catch {
      setDiscovering(false);
    }
  }, [stopTimers]);

  useEffect(() => {
    return () => {
      stopTimers();
      if (startedRef.current) {
        startedRef.current = false;
        void stopDiscover().catch(() => {});
      }
    };
  }, [stopTimers]);

  if (!supported) {
    return null;
  }

  const remainingSeconds =
    discovering && endsAt > 0 ? Math.max(0, Math.ceil((endsAt - nowMs) / 1000)) : 0;

  return (
    <SettingsSection
      label="Discover nearby"
      hint={
        discovering && peers.length === 0
          ? "Looking for instances in discover mode on this network…"
          : undefined
      }
      action={
        <SettingsButton onClick={beginDiscover} disabled={discovering}>
          {discovering ? (
            <RefreshCw size={14} className="hkp-set-spin" />
          ) : (
            <Search size={14} />
          )}
          {discovering ? `Searching… ${remainingSeconds}s` : "Find instances"}
        </SettingsButton>
      }
    >
      {peers.length > 0 && (
        <SettingsList>
          {peers.map((peer) => {
            const rtClass = peerToRuntimeClass(peer);
            const added = existing.some((e) => e.url === rtClass.url);
            const locked = authByPeer[peer.id] === "locked";
            const PlatformIcon = locked
              ? Lock
              : peer.platform === "ios"
                ? Smartphone
                : Monitor;
            return (
              <SettingsRow
                key={peer.id}
                icon={
                  <PlatformIcon
                    size={16}
                    color={locked ? "var(--set-warn)" : undefined}
                  />
                }
                title={peer.name}
                subtitle={
                  locked
                    ? "Not authorized on this device"
                    : `${peer.host}:${peer.port}`
                }
                trailing={
                  <SettingsButton
                    disabled={added || locked}
                    onClick={() => onAdd(rtClass)}
                  >
                    {locked ? (
                      <Lock size={14} />
                    ) : added ? (
                      <Check size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                    {locked ? "Locked" : added ? "Added" : "Add"}
                  </SettingsButton>
                }
              />
            );
          })}
        </SettingsList>
      )}
    </SettingsSection>
  );
}
