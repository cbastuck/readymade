import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAppContext } from "../../../AppContext";
import { useBoardContext } from "../../../BoardContext";
import { useCloudLogin } from "../../../auth/useCloudLogin";
import { CoordinatorDescriptor } from "../../../common";
import { deployBoard } from "../../../core/deploy";
import { listCoordinatorBoards } from "../../cloud/coordinatorClient";
import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { useMobileConnections } from "./MobileConnections";
import { M } from "./tokens";

/**
 * Deploying the open board: handing it to a coordinator that will own it.
 *
 * The board runs in this app, which provisions its runtimes and takes them
 * with it when it closes. Deploying registers it with a coordinator that
 * provisions the same runtimes itself and keeps them running with nobody
 * watching; from then on this app attaches to the board (the Cloud tab) rather
 * than owning it, which is where the caller sends the user next.
 *
 * The mobile counterpart of the toolbar's DeployMenu.
 */
export default function DeployBoardSheet({
  open,
  onClose,
  onDeployed,
  onManageCoordinators,
}: {
  open: boolean;
  onClose: () => void;
  /** The board is now the coordinator's; the host attaches to it. */
  onDeployed: (coordinator: CoordinatorDescriptor, boardName: string) => void;
  /** No coordinator configured yet — the host opens where they are managed. */
  onManageCoordinators: () => void;
}) {
  const boardContext = useBoardContext();
  const { user } = useAppContext();
  const login = useCloudLogin();
  const { coordinators } = useMobileConnections();

  const [busy, setBusy] = useState(false);
  /** Coordinators already running a board under this name — deploying there
   *  replaces it, which the sheet says before it happens. */
  const [replacing, setReplacing] = useState<Set<string>>(new Set());

  const boardName = boardContext?.boardName || "Untitled board";

  useEffect(() => {
    if (!open || !user || coordinators.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const found = new Set<string>();
      await Promise.all(
        coordinators.map(async (coordinator) => {
          try {
            const boards = await listCoordinatorBoards(
              coordinator.url,
              user.userId,
              user.idToken,
            );
            if (boards.some((board) => board.boardName === boardName)) {
              found.add(coordinator.url);
            }
          } catch {
            // Only used to warn about replacing. An unreachable coordinator
            // reports its real problem when it is deployed to.
          }
        }),
      );
      if (!cancelled) {
        setReplacing(found);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, boardName, coordinators]);

  const deploy = async (coordinator: CoordinatorDescriptor) => {
    if (!boardContext || !user || busy) {
      return;
    }
    setBusy(true);
    try {
      const name = await deployBoard(boardContext, coordinator, user);
      toast.success(`“${name}” is running on ${coordinator.name}`);
      onClose();
      onDeployed(coordinator, name);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? `Deploy failed — ${err.message}`
          : "Deploy failed",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Deploy board" height="auto">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Where the board runs right now, said plainly — this is the moment
            the user changes it. */}
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: M.textSecondary,
            padding: "0 4px 4px",
          }}
        >
          <span style={{ fontWeight: 600, color: M.textPrimary }}>
            “{boardName}”
          </span>{" "}
          runs in this app — closing it stops the board. Deploy it to a
          coordinator to keep it running:
        </div>

        {!user && (
          <button
            onClick={() => void login()}
            style={rowStyle}
            disabled={busy}
          >
            <RowIcon name="user" color={M.blue} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={titleStyle}>Log in to deploy</div>
              <div style={hintStyle}>A coordinator runs boards for your account</div>
            </div>
          </button>
        )}

        {user && coordinators.length === 0 && (
          <button
            onClick={() => {
              onClose();
              onManageCoordinators();
            }}
            style={rowStyle}
          >
            <RowIcon name="cloud" color={M.blue} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={titleStyle}>Add a coordinator…</div>
              <div style={hintStyle}>
                A board needs somewhere to run once it leaves this app
              </div>
            </div>
          </button>
        )}

        {user &&
          coordinators.map((coordinator) => (
            <button
              key={coordinator.url}
              onClick={() => void deploy(coordinator)}
              disabled={busy}
              style={{
                ...rowStyle,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.5 : 1,
              }}
            >
              <RowIcon name="cloud" color={M.tealDark} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={titleStyle}>{coordinator.name}</div>
                <div style={hintStyle}>
                  {replacing.has(coordinator.url)
                    ? "Replaces the board already running there"
                    : coordinator.url}
                </div>
              </div>
              {busy && (
                <span style={{ fontSize: 12, color: M.textMuted, flexShrink: 0 }}>
                  Deploying…
                </span>
              )}
            </button>
          ))}
      </div>
    </BottomSheet>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "13px 14px",
  width: "100%",
  background: M.card,
  border: `1px solid ${M.border}`,
  borderRadius: 12,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: M.textPrimary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: M.textMuted,
  marginTop: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function RowIcon({
  name,
  color,
}: {
  name: "cloud" | "user";
  color: string;
}) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        background: M.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <MobileIcon name={name} size={18} color={color} />
    </div>
  );
}
