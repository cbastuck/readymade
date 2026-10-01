import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { CoordinatorDescriptor } from "hkp-frontend/src/common";
import { DeployableBoard, checkDeploy } from "hkp-frontend/src/core/deploy";
import {
  RuntimePreflight,
  blocksDeploy,
  describePreflight,
} from "hkp-frontend/src/core/deployPreflight";

/**
 * What a person sees before a board is handed to a coordinator: each of its
 * runtimes, where it would run, and whether it can.
 *
 * Deploying gives the board's runtimes up, so anything that would stop it is
 * shown here first — while the board is still this browser's, and the problem
 * is one that can be fixed from it. Where a board named a remote, or asked for
 * a kind of runtime server, the one this client chose is said by name: a person
 * with two servers that would do should see which the board landed on.
 */

type Props = {
  board: DeployableBoard;
  user: { userId: string; idToken: string };
  /** The coordinator chosen; null closes the dialog. */
  coordinator: CoordinatorDescriptor | null;
  /** Whether a deploy is under way; the dialog stays open and waits. */
  busy: boolean;
  /** What went wrong deploying, when something did. */
  error?: string;
  onDeploy: (coordinator: CoordinatorDescriptor) => void;
  onClose: () => void;
};

const toneOf = (finding: RuntimePreflight): string =>
  blocksDeploy(finding)
    ? "#dc2626"
    : finding.status === "ready"
      ? "#22c55e"
      : "var(--text-dim, #9ca3af)";

const buttonStyle: React.CSSProperties = {
  border: "1px solid var(--border-mid, #e2ddd7)",
  borderRadius: 7,
  background: "none",
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text, #1a1a1a)",
  cursor: "pointer",
};

export default function DeployDialog({
  board,
  user,
  coordinator,
  busy,
  error,
  onDeploy,
  onClose,
}: Props) {
  const [findings, setFindings] = useState<RuntimePreflight[] | null>(null);
  const [checkError, setCheckError] = useState<string>();
  /** Bumped to ask again; the check is otherwise made once per opening. */
  const [attempt, setAttempt] = useState(0);

  const open = !!coordinator;

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setFindings(null);
    setCheckError(undefined);
    checkDeploy(board, user)
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
    // The board and user are read when the dialog opens or is asked to check
    // again; re-running on every render of the board would re-ask each runtime
    // server continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);

  const blocked = !!findings?.some(blocksDeploy);
  const canDeploy = !!findings && !blocked && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-[520px]"
        data-testid="deploy-dialog"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        <DialogTitle>Deploy to {coordinator?.name}</DialogTitle>
        <DialogDescription>
          The board keeps running there when this is closed. Each runtime server
          it uses connects to the coordinator itself — nothing has to be able to
          reach it.
        </DialogDescription>

        <div
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
          data-testid="deploy-findings"
        >
          {!findings && !checkError && (
            <div style={{ fontSize: 13, color: "var(--text-dim, #6b7280)" }}>
              Checking the board’s runtimes…
            </div>
          )}
          {checkError && (
            <div style={{ fontSize: 13, color: "#dc2626" }}>{checkError}</div>
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
                  color: blocksDeploy(finding)
                    ? "#dc2626"
                    : "var(--text, #1a1a1a)",
                }}
              >
                {describePreflight(finding)}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div
            data-testid="deploy-error"
            style={{ fontSize: 13, lineHeight: 1.45, color: "#dc2626" }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {(blocked || checkError) && (
            <button
              type="button"
              style={buttonStyle}
              disabled={busy}
              onClick={() => setAttempt((n) => n + 1)}
            >
              Check again
            </button>
          )}
          <button
            type="button"
            style={buttonStyle}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDeploy}
            onClick={() => coordinator && onDeploy(coordinator)}
            style={{
              ...buttonStyle,
              border: "none",
              background: "var(--hkp-accent, #3b5bff)",
              color: "white",
              opacity: canDeploy ? 1 : 0.45,
              cursor: canDeploy ? "pointer" : "default",
            }}
          >
            {busy ? "Deploying…" : "Deploy"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
