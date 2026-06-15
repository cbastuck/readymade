import { useState } from "react";
import { useBoardContext } from "../../../BoardContext";
import { MobileHostContext } from "../../../MobileHostContext";
import { M } from "./tokens";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import MobileBoardCanvas from "./MobileBoardCanvas";
import MobileCloudBoards from "../../cloud/mobile/MobileCloudBoards";
import MobileHub from "./MobileHub";

type Tab = "board" | "cloud" | "hub";

type MobilePlaygroundInnerProps = {
  suggestedName?: string;
};

// ── Tab bar button ─────────────────────────────────────────────
function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: MobileIconName;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <MobileIcon
        name={icon}
        size={22}
        color={active ? M.teal : M.textMuted}
        strokeWidth={active ? 2 : 1.6}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: active ? 600 : 400,
          color: active ? M.teal : M.textMuted,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ── Top bar ────────────────────────────────────────────────────
function TopBar({
  boardName,
  runtimeCount,
  serviceCount,
}: {
  boardName: string;
  runtimeCount: number;
  serviceCount: number;
}) {
  return (
    <div
      style={{
        background: `rgba(242,237,232,0.92)`,
        backdropFilter: "blur(12px)",
        paddingTop: "max(10px, env(safe-area-inset-top))",
        paddingBottom: "10px",
        paddingLeft: "16px",
        paddingRight: "16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: `1px solid ${M.border}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MobileIcon name="layers" size={16} color="#fff" strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: M.textPrimary,
            lineHeight: 1,
          }}
        >
          {boardName || "Untitled Board"}
        </div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 2 }}>
          {runtimeCount} runtime{runtimeCount !== 1 ? "s" : ""} · {serviceCount}{" "}
          service{serviceCount !== 1 ? "s" : ""}
        </div>
      </div>
      <button
        style={{
          width: 34,
          height: 34,
          border: "none",
          background: "rgba(0,0,0,0.06)",
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <MobileIcon name="more" size={16} color={M.textSecondary} />
      </button>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function MobilePlaygroundInner({
  suggestedName,
}: MobilePlaygroundInnerProps) {
  const boardContext = useBoardContext();
  const [tab, setTab] = useState<Tab>("board");

  if (!boardContext) {
    return null;
  }

  const { runtimes, services, boardName } = boardContext;
  const displayName = boardName || suggestedName || "Untitled Board";
  const rtCount = runtimes.length;
  const svcCount = Object.values(services).flat().length;

  return (
    <MobileHostContext.Provider value={true}>
    <div
      style={{
        width: "100%",
        height: "100%",
        background: M.bg,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* The cloud view renders its own header; hide the local-board TopBar there. */}
      {tab !== "cloud" && (
        <TopBar
          boardName={displayName}
          runtimeCount={rtCount}
          serviceCount={svcCount}
        />
      )}

      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tab === "board" && <MobileBoardCanvas />}
        {tab === "cloud" && <MobileCloudBoards />}
        {tab === "hub" && (
          <MobileHub
            suggestedName={displayName}
            onBoardLoaded={() => setTab("board")}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <div
        style={{
          background: "rgba(242,237,232,0.95)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${M.border}`,
          display: "flex",
          alignItems: "center",
          paddingTop: "8px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          paddingLeft: 0,
          paddingRight: 0,
          flexShrink: 0,
        }}
      >
        <TabButton
          label="Board"
          icon="home"
          active={tab === "board"}
          onClick={() => setTab("board")}
        />
        <TabButton
          label="Cloud"
          icon="cloud"
          active={tab === "cloud"}
          onClick={() => setTab("cloud")}
        />
        <TabButton
          label="Hub"
          icon="package"
          active={tab === "hub"}
          onClick={() => setTab("hub")}
        />
      </div>
    </div>
    </MobileHostContext.Provider>
  );
}
