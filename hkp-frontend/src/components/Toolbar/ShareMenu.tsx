import { FormEvent, useContext, useEffect, useState } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import {
  getCloudBoard,
  listCloudBoards,
  shareCloudBoard,
  unshareCloudBoard,
  upsertCloudBoard,
} from "hkp-frontend/src/cloud/boardStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="10.5" cy="2.5" r="1.5" />
      <circle cx="10.5" cy="10.5" r="1.5" />
      <circle cx="2.5" cy="6.5" r="1.5" />
      <line x1="3.9" y1="5.8" x2="9.1" y2="3.2" />
      <line x1="3.9" y1="7.2" x2="9.1" y2="9.8" />
    </svg>
  );
}

/** "a@b.c, d@e.f g@h.i" → ["a@b.c", "d@e.f", "g@h.i"]; lowercased to match
 *  the server-side share matching. */
function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email !== ""),
    ),
  ];
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const menuItemStyle: React.CSSProperties = {
  outline: "none",
  borderRadius: 6,
  padding: "7px 10px",
  userSelect: "none",
};

/**
 * The toolbar's share control: a pulldown offering the classic "copy board
 * link" (self-contained URL, no login needed) and "Share with people…",
 * which uploads the board to the user's cloud storage and grants read
 * access to the given email addresses.
 */
export default function ShareMenu() {
  const boardContext = useContext(BoardCtx);
  const user = boardContext?.appContext?.user;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The board's cloud record, looked up when the dialog opens: null id while
  // loading or when the board was never uploaded; shares null = still loading.
  const [cloudId, setCloudId] = useState<string | null>(null);
  const [shares, setShares] = useState<string[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const boardName = boardContext?.boardName;

  useEffect(() => {
    if (!dialogOpen || !user || !boardName) {
      return;
    }
    let cancelled = false;
    setCloudId(null);
    setShares(null);
    const auth = { idToken: user.idToken };
    (async () => {
      const boards = await listCloudBoards(auth);
      const match = boards.find(
        (board) => board.role === "owner" && board.name === boardName,
      );
      if (!match) {
        // Not uploaded yet — it will be, on the first share.
        if (!cancelled) {
          setShares([]);
        }
        return;
      }
      const full = await getCloudBoard(auth, match.id);
      if (!cancelled) {
        setCloudId(full.id);
        setShares(full.sharedWith ?? []);
      }
    })().catch(() => {
      // Not fatal for the dialog: sharing still works, the list is unknown.
      if (!cancelled) {
        setShares([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, user, boardName]);

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setError(null);
      setBusy(false);
      setRevoking(null);
    }
  };

  const revoke = async (email: string) => {
    if (!cloudId || !user || revoking) {
      return;
    }
    setRevoking(email);
    setError(null);
    try {
      await unshareCloudBoard({ idToken: user.idToken }, cloudId, email);
      setShares((current) =>
        current ? current.filter((entry) => entry !== email) : current,
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Please try again.",
      );
    } finally {
      setRevoking(null);
    }
  };

  const share = async (event: FormEvent) => {
    event.preventDefault();
    if (!boardContext || !user || busy) {
      return;
    }
    const emails = parseEmails(emailsRaw);
    if (emails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }
    const invalid = emails.filter((email) => !EMAIL_RE.test(email));
    if (invalid.length > 0) {
      setError(`Not a valid email address: ${invalid.join(", ")}`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const data = await boardContext.serializeBoard();
      if (!data) {
        throw new Error("Could not serialize the current board");
      }
      const name = boardContext.boardName || data.boardName || "Untitled board";
      const auth = { idToken: user.idToken };
      const { id } = await upsertCloudBoard(auth, {
        name,
        data: data as unknown as Record<string, unknown>,
        metadata: data.description
          ? { description: data.description }
          : undefined,
      });
      for (const email of emails) {
        await shareCloudBoard(auth, id, email);
      }
      // Stay open: the recipients list below is the confirmation, and the
      // next share or a revoke is one step away.
      setCloudId(id);
      setShares((current) => [
        ...new Set([...(current ?? []), ...emails]),
      ]);
      setEmailsRaw("");
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            title="Share"
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text, #1a1a1a)",
            }}
          >
            <ShareIcon />
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={6}
            style={{
              zIndex: 200,
              minWidth: 230,
              background: "var(--bg-card, white)",
              border: "1px solid var(--border-mid, #e2ddd7)",
              borderRadius: 10,
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
              padding: 5,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            <DropdownMenuPrimitive.Item
              className="hkp-board-menu-item"
              style={{ ...menuItemStyle, cursor: "pointer" }}
              onSelect={() =>
                boardContext?.onAction({ type: "createBoardLink" })
              }
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text, #1a1a1a)",
                  lineHeight: 1.3,
                }}
              >
                Copy board link
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-dim, #9ca3af)",
                  marginTop: 1,
                  lineHeight: 1.4,
                }}
              >
                Anyone with the link can open a copy of this board
              </div>
            </DropdownMenuPrimitive.Item>

            <DropdownMenuPrimitive.Item
              className="hkp-board-menu-item"
              disabled={!user}
              style={{
                ...menuItemStyle,
                cursor: user ? "pointer" : "default",
                opacity: user ? 1 : 0.4,
              }}
              onSelect={() => setDialogOpen(true)}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text, #1a1a1a)",
                  lineHeight: 1.3,
                }}
              >
                Share with people…
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-dim, #9ca3af)",
                  marginTop: 1,
                  lineHeight: 1.4,
                }}
              >
                {user
                  ? "Upload to the cloud and give access by email"
                  : "Log in to share by email"}
              </div>
            </DropdownMenuPrimitive.Item>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md w-[90vw]">
          <DialogHeader>
            <DialogTitle>Share board</DialogTitle>
            <DialogDescription>
              The board is uploaded to your cloud boards, and the people below
              can view it after logging in with the given email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void share(event)}>
            <input
              type="text"
              autoFocus
              value={emailsRaw}
              disabled={busy}
              onChange={(event) => setEmailsRaw(event.target.value)}
              placeholder="email@example.com, another@example.com"
              // >=16px so mobile Safari doesn't zoom into the field.
              style={{
                width: "100%",
                fontSize: 16,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-mid, #d1d5db)",
                background: "var(--bg-card, white)",
                color: "var(--text, #1a1a1a)",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "#e0355f" }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-dim, #9ca3af)",
                  marginBottom: 6,
                }}
              >
                Shared with
              </div>
              {shares === null && (
                <div style={{ fontSize: 12.5, color: "var(--text-dim, #9ca3af)" }}>
                  Loading…
                </div>
              )}
              {shares !== null && shares.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-dim, #9ca3af)" }}>
                  Nobody yet.
                </div>
              )}
              {shares?.map((email) => (
                <div
                  key={email}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 0",
                  }}
                >
                  <span
                    style={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--text, #1a1a1a)",
                    }}
                  >
                    {email}
                  </span>
                  <button
                    type="button"
                    disabled={revoking !== null || !cloudId}
                    onClick={() => void revoke(email)}
                    style={{
                      flex: "0 0 auto",
                      border: "none",
                      background: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#e0355f",
                      cursor:
                        revoking !== null || !cloudId ? "default" : "pointer",
                      opacity: revoking !== null || !cloudId ? 0.5 : 1,
                      padding: "2px 4px",
                    }}
                  >
                    {revoking === email ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <button
                type="submit"
                disabled={busy}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--hkp-accent, #3b5bff)",
                  color: "white",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "Sharing…" : "Share"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
