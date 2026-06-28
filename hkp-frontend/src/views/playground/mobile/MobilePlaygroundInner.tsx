import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useBoardContext } from "../../../BoardContext";
import { MobileHostContext } from "../../../MobileHostContext";
import { storeBoardToLocalStorage } from "../common";
import { createBoardLink } from "../BoardLink";
import { M } from "./tokens";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import MobileBoardCanvas from "./MobileBoardCanvas";
import MobileCloudBoards from "../../cloud/mobile/MobileCloudBoards";
import MobileHub from "./MobileHub";
import {
  MobileConnectionsProvider,
  useMobileConnections,
} from "./MobileConnections";
import BoardMenuSheet from "./BoardMenuSheet";
import SaveBoardSheet from "./SaveBoardSheet";

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
  onMenu,
}: {
  boardName: string;
  runtimeCount: number;
  serviceCount: number;
  onMenu: () => void;
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
        onClick={onMenu}
        aria-label="Board menu"
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

// ── Shell (runs inside the connections provider) ───────────────
function PlaygroundShell({ suggestedName }: MobilePlaygroundInnerProps) {
  const boardContext = useBoardContext();
  const { runtimeEngines } = useMobileConnections();
  const [tab, setTab] = useState<Tab>("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  // Surface Hub-managed external runtimes in the local board provider's
  // available-engine pool so a newly registered runtime is immediately
  // available on the Board tab's Add-runtime sheet. Additive for engines a
  // loaded board contributed (we never strip those); but reconcile entries that
  // share a URL so a corrected type/name from the Hub propagates live instead
  // of only on the next load. Removals still persist via the store.
  useEffect(() => {
    if (!boardContext) {
      return;
    }
    const available = boardContext.availableRuntimeEngines;
    for (const rt of runtimeEngines) {
      if (!rt.url) {
        continue;
      }
      const existing = available.find((e) => e.url === rt.url);
      if (!existing) {
        boardContext.addAvailableRuntime(rt, true);
      } else if (existing.type !== rt.type || existing.name !== rt.name) {
        // addAvailableRuntime overwrites by name, so drop the stale entry first
        // (its name may differ from the corrected one) before re-adding.
        boardContext.removeAvailableRuntime(existing);
        boardContext.addAvailableRuntime(rt, true);
      }
    }
  }, [runtimeEngines, boardContext]);

  if (!boardContext) {
    return null;
  }

  const { runtimes, services, boardName } = boardContext;
  const displayName = boardName || suggestedName || "Untitled Board";
  const rtCount = runtimes.length;
  const svcCount = Object.values(services).flat().length;

  const onSave = async (name: string) => {
    const finalName = name.trim() || "Untitled";
    const data = await boardContext.serializeBoard();
    if (!data) {
      toast.error("Could not read the current board");
      return;
    }
    // Persist boardName alongside the source so loading restores the name.
    storeBoardToLocalStorage(
      finalName,
      JSON.stringify({ ...data, boardName: finalName, name: finalName }),
      data.description,
    );
    toast.success(`Saved “${finalName}” to this device`);
  };

  const onShare = async () => {
    const data = await boardContext.serializeBoard();
    if (!data) {
      toast.error("Could not read the current board");
      return;
    }
    const link = createBoardLink(
      JSON.stringify({ ...data, boardName: displayName }),
    );
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.message("Share link", { description: link });
    }
  };

  const onNew = async () => {
    await boardContext.clearBoard();
    setTab("board");
    toast.success("Started a new board");
  };

  return (
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
          onMenu={() => setMenuOpen(true)}
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

      <BoardMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSave={() => setSaveOpen(true)}
        onShare={onShare}
        onNew={onNew}
      />
      <SaveBoardSheet
        open={saveOpen}
        initialName={displayName}
        onClose={() => setSaveOpen(false)}
        onSave={(name) => {
          setSaveOpen(false);
          void onSave(name);
        }}
      />
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function MobilePlaygroundInner({
  suggestedName,
}: MobilePlaygroundInnerProps) {
  const boardContext = useBoardContext();

  if (!boardContext) {
    return null;
  }

  return (
    <MobileHostContext.Provider value={true}>
      <MobileConnectionsProvider>
        <PlaygroundShell suggestedName={suggestedName} />
      </MobileConnectionsProvider>
    </MobileHostContext.Provider>
  );
}
