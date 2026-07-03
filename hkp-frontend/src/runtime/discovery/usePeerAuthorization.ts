import { useEffect, useRef, useState } from "react";

import { useAppContext } from "../../AppContext";
import {
  type DiscoveredPeer,
  type PeerAuthStatus,
  probePeerAuthorization,
} from "./DiscoveryApi";

// Probes each discovered peer's authorization for the current user and returns a
// map of peer id → status. Each peer is probed once per appearance; results
// persist across discovery polls. A change of token (e.g. after login/logout)
// invalidates prior results and re-probes, so a peer can move from "locked" to
// "authorized" once the user signs in with an allowed account.
export function usePeerAuthorization(
  peers: DiscoveredPeer[],
): Record<string, PeerAuthStatus> {
  const { user } = useAppContext();
  const idToken = user?.idToken;
  const [statusByPeer, setStatusByPeer] = useState<
    Record<string, PeerAuthStatus>
  >({});
  const probedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    probedRef.current.clear();
    setStatusByPeer({});
  }, [idToken]);

  useEffect(() => {
    let cancelled = false;
    for (const peer of peers) {
      if (probedRef.current.has(peer.id)) {
        continue;
      }
      probedRef.current.add(peer.id);
      setStatusByPeer((prev) => ({ ...prev, [peer.id]: "probing" }));
      void probePeerAuthorization(peer, idToken).then((status) => {
        if (!cancelled) {
          setStatusByPeer((prev) => ({ ...prev, [peer.id]: status }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [peers, idToken]);

  return statusByPeer;
}
