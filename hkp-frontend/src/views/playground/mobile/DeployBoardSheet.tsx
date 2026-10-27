import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAppContext } from "../../../AppContext";
import { useBoardContext } from "../../../BoardContext";
import { useCloudLogin } from "../../../auth/useCloudLogin";
import { CoordinatorDescriptor } from "../../../common";
import { checkDeploy, deployBoard, describeDeploy } from "../../../core/deploy";
import {
  DeployPreflightError,
  RuntimePreflight,
  blocksDeploy,
  describePreflight,
} from "../../../core/deployPreflight";
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
 * The mobile counterpart of the toolbar's DeployMenu and DeployDialog. Before
 * anything is handed over it shows what deploying would find, runtime by
 * runtime (`core/deployPreflight`): deploying gives the board's runtimes up, so
 * a problem is shown while the board is still this app's and it can be fixed
 * from here. The findings do not depend on the coordinator, so they are asked
 * once, when the sheet opens, and a coordinator is chosen below them.
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

  const [findings, setFindings] = useState<RuntimePreflight[] | null>(null);
  const [checkError, setCheckError] = useState<string>();
  /** Bumped to ask again; the check is otherwise made once per opening. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !user || !boardContext) {
      return;
    }
    let cancelled = false;
    setFindings(null);
    setCheckError(undefined);
    checkDeploy(boardContext, user)
      .then((result) => {
        if (!cancelled) {
          setFindings(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCheckError(
            err instanceof Error && err.message
              ? err.message
              : "Could not check the board",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // The board is read when the sheet opens or is asked to check again;
    // re-running on every change of the board would re-ask each runtime
    // server continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, attempt]);

  const blocked = !!findings?.some(blocksDeploy);
  const checking = !!user && !findings && !checkError;
  const canDeploy = !!findings && !blocked && !busy;

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
      const result = await deployBoard(boardContext, coordinator, user);
      // The board is the coordinator's either way, so the host attaches to it
      // — including when it did not start.
      const outcome = describeDeploy(result, coordinator.name);
      (outcome.ok ? toast.success : toast.error)(outcome.message);
      onClose();
      onDeployed(coordinator, result.boardName);
    } catch (err) {
      // What changed since the sheet checked: shown where the findings are,
      // and nothing was handed over.
      if (err instanceof DeployPreflightError) {
        setFindings(err.findings);
        return;
      }
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

        {user && (
          <div
            data-testid="deploy-findings"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "12px 14px",
              background: M.card,
              border: `1px solid ${blocked || checkError ? M.danger : M.border}`,
              borderRadius: 12,
            }}
          >
            <div style={sectionLabelStyle}>Runtimes</div>
            {checking && (
              <div style={{ fontSize: 13, color: M.textMuted }}>
                Checking the board’s runtimes…
              </div>
            )}
            {checkError && (
              <div style={{ fontSize: 13, color: M.danger }}>{checkError}</div>
            )}
            {findings?.map((finding) => (
              <div
                key={finding.runtimeId}
                data-testid={`deploy-finding-${finding.runtimeId}`}
                data-status={finding.status}
                style={{ display: "flex", alignItems: "baseline", gap: 8 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: toneOf(finding),
                    transform: "translateY(-1px)",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: blocksDeploy(finding) ? M.danger : M.textPrimary,
                  }}
                >
                  {describePreflight(finding)}
                </span>
              </div>
            ))}
            {(blocked || checkError) && (
              <button
                onClick={() => setAttempt((n) => n + 1)}
                disabled={busy}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 2,
                  height: 34,
                  padding: "0 12px",
                  border: `1px solid ${M.border}`,
                  borderRadius: 9,
                  background: M.card,
                  color: M.textSecondary,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Check again
              </button>
            )}
          </div>
        )}

        {user && blocked && coordinators.length > 0 && (
          <div style={{ fontSize: 12, color: M.textMuted, padding: "0 4px" }}>
            Fix what is marked above, then check again, before deploying.
          </div>
        )}

        {user &&
          coordinators.map((coordinator) => (
            <button
              key={coordinator.url}
              onClick={() => void deploy(coordinator)}
              disabled={!canDeploy}
              style={{
                ...rowStyle,
                cursor: canDeploy ? "pointer" : "default",
                opacity: canDeploy ? 1 : 0.5,
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

// Ready is green, a browser runtime that runs only while the board is open is
// neither, and anything that stops the deploy is red — as on the desktop.
const toneOf = (finding: RuntimePreflight): string =>
  blocksDeploy(finding)
    ? M.danger
    : finding.status === "ready"
      ? M.green
      : M.borderStrong;

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: M.textMuted,
  textTransform: "uppercase",
};

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
