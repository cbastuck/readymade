import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

import BottomSheet from "./BottomSheet";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import { M } from "./tokens";
import { useMobileConnections } from "./MobileConnections";
import { toCanonicalRuntimeClassType } from "../../../types";
import {
  type DiscoveredPeer,
  getDiscoverState,
  isDiscoverySupported,
  peerToRuntimeClass,
  startDiscover,
  stopDiscover,
} from "../../../runtime/discovery/DiscoveryApi";
import { usePeerAuthorization } from "../../../runtime/discovery/usePeerAuthorization";

const PLATFORM_ICON: Record<string, MobileIconName> = {
  ios: "cpu",
  macos: "monitor",
  windows: "monitor",
  linux: "monitor",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const TYPE_ICON: Record<string, MobileIconName> = {
  graphql: "gitBranch",
  rest: "server",
};

const TYPE_OPTIONS: { value: "rest" | "graphql"; label: string }[] = [
  { value: "rest", label: "REST" },
  { value: "graphql", label: "GraphQL" },
];

const inputStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${M.border}`,
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 16, // >=16 prevents iOS auto-zoom on focus
  fontFamily: "inherit",
  color: M.textPrimary,
  background: M.bg,
  outline: "none",
  boxSizing: "border-box",
};

export default function ManageRuntimesSheet({ open, onClose }: Props) {
  const { runtimeEngines, addRuntimeEngine, removeRuntimeEngine } =
    useMobileConnections();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"rest" | "graphql">("rest");

  // ── Discovery ──
  const supportsDiscovery = isDiscoverySupported();
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

  // Tear down the discover window when the sheet closes or unmounts.
  useEffect(() => {
    if (!open) {
      stopTimers();
      setDiscovering(false);
      setPeers([]);
      if (startedRef.current) {
        startedRef.current = false;
        void stopDiscover().catch(() => {});
      }
    }
    return () => stopTimers();
  }, [open, stopTimers]);

  const remainingSeconds =
    discovering && endsAt > 0 ? Math.max(0, Math.ceil((endsAt - nowMs) / 1000)) : 0;

  const canAdd = name.trim().length > 0 && url.trim().length > 0;

  const onAdd = () => {
    if (!canAdd) {
      return;
    }
    // Strip trailing slashes: the REST API appends paths like `/runtimes`, so a
    // trailing slash would produce a malformed `…:8887//runtimes` URL.
    const normalizedUrl = url.trim().replace(/\/+$/, "");
    addRuntimeEngine({ type, name: name.trim(), url: normalizedUrl });
    setName("");
    setUrl("");
    setType("rest");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Manage Runtimes" height="80%">
      {runtimeEngines.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: M.textMuted,
            fontStyle: "italic",
            padding: "4px 4px 16px",
            lineHeight: 1.5,
          }}
        >
          No external runtimes yet — add one below to make it available on the
          board.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {runtimeEngines.map((rt, i) => {
            const canonical = toCanonicalRuntimeClassType(rt.type);
            const iconName: MobileIconName = TYPE_ICON[canonical] ?? "cpu";
            return (
              <div
                key={rt.url ?? i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: `1px solid ${M.border}`,
                  borderRadius: 12,
                  background: M.card,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: M.blueLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MobileIcon name={iconName} size={18} color={M.blue} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: M.textPrimary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rt.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: M.textMuted,
                      marginTop: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rt.url}
                  </div>
                </div>
                <button
                  onClick={() => removeRuntimeEngine(rt)}
                  aria-label={`Remove ${rt.name}`}
                  style={{
                    width: 34,
                    height: 34,
                    border: "none",
                    background: "rgba(239,68,68,0.1)",
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <MobileIcon name="trash" size={15} color={M.danger} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Discover nearby instances ── */}
      {supportsDiscovery && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            border: `1px solid ${M.border}`,
            borderRadius: 14,
            background: M.bg,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: M.textMuted,
            }}
          >
            Discover nearby
          </div>
          <button
            onClick={beginDiscover}
            disabled={discovering}
            style={{
              height: 44,
              border: `1.5px solid ${M.teal}`,
              borderRadius: 10,
              background: discovering ? M.tealLight : M.card,
              color: M.tealDark,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: discovering ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <MobileIcon
              name={discovering ? "refresh" : "search"}
              size={16}
              color={M.tealDark}
            />
            {discovering
              ? `Searching… ${remainingSeconds}s`
              : "Find Meander instances"}
          </button>

          {discovering && peers.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: M.textMuted,
                fontStyle: "italic",
                textAlign: "center",
                padding: "4px 0",
              }}
            >
              Looking for instances in discover mode on this network…
            </div>
          )}

          {peers.map((peer) => {
            const rtClass = peerToRuntimeClass(peer);
            const added = runtimeEngines.some((e) => e.url === rtClass.url);
            const locked = authByPeer[peer.id] === "locked";
            const iconName: MobileIconName = locked
              ? "lock"
              : PLATFORM_ICON[peer.platform] ?? "server";
            return (
              <div
                key={peer.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: `1px solid ${M.border}`,
                  borderRadius: 12,
                  background: M.card,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: locked ? "rgba(0,0,0,0.06)" : M.blueLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <MobileIcon
                    name={iconName}
                    size={18}
                    color={locked ? M.textMuted : M.blue}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: M.textPrimary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {peer.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: M.textMuted,
                      marginTop: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {locked ? "Not authorized on this device" : `${peer.host}:${peer.port}`}
                  </div>
                </div>
                <button
                  onClick={() => addRuntimeEngine(rtClass)}
                  disabled={added || locked}
                  aria-label={locked ? `${peer.name} locked` : `Add ${peer.name}`}
                  style={{
                    width: 34,
                    height: 34,
                    border: "none",
                    background: added || locked ? "rgba(0,0,0,0.06)" : M.tealLight,
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: added || locked ? "default" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  <MobileIcon
                    name={locked ? "lock" : added ? "check" : "plus"}
                    size={16}
                    color={added || locked ? M.textMuted : M.tealDark}
                    strokeWidth={2.2}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add an external runtime ── */}
      <div
        style={{
          marginTop: 12,
          padding: 14,
          border: `1px solid ${M.border}`,
          borderRadius: 14,
          background: M.bg,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: M.textMuted,
          }}
        >
          Add a runtime
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={inputStyle}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Host URL — http://127.0.0.1:8080"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                style={{
                  flex: 1,
                  height: 40,
                  border: `1.5px solid ${active ? M.teal : M.border}`,
                  borderRadius: 10,
                  background: active ? M.tealLight : M.card,
                  color: active ? M.tealDark : M.textSecondary,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onAdd}
          disabled={!canAdd}
          style={{
            height: 46,
            border: "none",
            borderRadius: 12,
            background: canAdd ? M.teal : M.borderStrong,
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 600,
            cursor: canAdd ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MobileIcon name="plus" size={16} color="#fff" strokeWidth={2.2} />
          Register runtime
        </button>
      </div>
    </BottomSheet>
  );
}
