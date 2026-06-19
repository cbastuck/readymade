import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Monitor, Plus, RefreshCw, Search, Smartphone } from "lucide-react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { RuntimeClass } from "hkp-frontend/src/types";
import {
  type DiscoveredPeer,
  getDiscoverState,
  isDiscoverySupported,
  peerToRuntimeClass,
  startDiscover,
  stopDiscover,
} from "hkp-frontend/src/runtime/discovery/DiscoveryApi";

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
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Discover nearby
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={beginDiscover}
          disabled={discovering}
          className="gap-2"
        >
          {discovering ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {discovering ? `Searching… ${remainingSeconds}s` : "Find instances"}
        </Button>
      </div>

      {discovering && peers.length === 0 && (
        <p className="py-1 text-center text-sm italic text-slate-400">
          Looking for instances in discover mode on this network…
        </p>
      )}

      {peers.map((peer) => {
        const rtClass = peerToRuntimeClass(peer);
        const added = existing.some((e) => e.url === rtClass.url);
        const PlatformIcon = peer.platform === "ios" ? Smartphone : Monitor;
        return (
          <div
            key={peer.id}
            className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <PlatformIcon size={18} className="shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">
                {peer.name}
              </div>
              <div className="truncate text-xs text-slate-500">
                {peer.host}:{peer.port}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={added}
              onClick={() => onAdd(rtClass)}
              className="gap-1"
            >
              {added ? <Check size={14} /> : <Plus size={14} />}
              {added ? "Added" : "Add"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
