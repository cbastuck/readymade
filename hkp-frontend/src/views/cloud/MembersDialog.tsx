import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { copyToClipboard } from "hkp-frontend/src/clipboard";
import {
  BoardMember,
  listBoardMembers,
  removeBoardMember,
  setBoardMember,
} from "./coordinatorClient";
import { createSharedBoardLink } from "./sharedLink";

/**
 * Who a deployed board is shared with.
 *
 * The owner's list, kept by the board's coordinator: an address somebody signs
 * in with, and the name the board calls them. Whoever is on it may open the
 * board and use its facade — nothing else of the board is theirs to see — and
 * the name is what the other members see where the board shows who did
 * something, so it is the owner's to choose and not the person's own.
 */

type Props = {
  isOpen: boolean;
  coordinatorUrl: string;
  /** The owner: the person signed in. */
  userId: string;
  idToken: string;
  boardName: string;
  onClose: () => void;
};

export default function MembersDialog({
  isOpen,
  coordinatorUrl,
  userId,
  idToken,
  boardName,
  onClose,
}: Props) {
  const [members, setMembers] = useState<BoardMember[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // The entry whose name is being changed, by email; its address is its key
  // and is not editable — a different address is a different person.
  const [editing, setEditing] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let stale = false;
    setMembers(null);
    setError("");
    setEmail("");
    setName("");
    setEditing(null);
    setCopied(false);
    listBoardMembers(coordinatorUrl, userId, idToken, boardName).then(
      (list) => {
        if (!stale) {
          setMembers(list);
        }
      },
      (err) => {
        if (!stale) {
          setMembers([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      },
    );
    return () => {
      stale = true;
    };
  }, [isOpen, coordinatorUrl, userId, idToken, boardName]);

  /** Runs a change and takes the list it answers with. */
  const change = useCallback(
    async (work: () => Promise<BoardMember[]>): Promise<boolean> => {
      setBusy(true);
      setError("");
      try {
        setMembers(await work());
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const canAdd =
    !busy && /^[^\s@]+@[^\s@]+$/.test(email.trim()) && !!name.trim();

  const add = async () => {
    if (!canAdd) {
      return;
    }
    const added = await change(() =>
      setBoardMember(coordinatorUrl, userId, idToken, boardName, {
        email: email.trim(),
        name: name.trim(),
      }),
    );
    if (added) {
      setEmail("");
      setName("");
    }
  };

  const rename = async (member: BoardMember) => {
    const next = editedName.trim();
    if (!next || next === member.name) {
      setEditing(null);
      return;
    }
    if (
      await change(() =>
        setBoardMember(coordinatorUrl, userId, idToken, boardName, {
          email: member.email,
          name: next,
        }),
      )
    ) {
      setEditing(null);
    }
  };

  const remove = (member: BoardMember) =>
    change(() =>
      removeBoardMember(
        coordinatorUrl,
        userId,
        idToken,
        boardName,
        member.email,
      ),
    );

  const copyLink = async () => {
    const link = createSharedBoardLink({
      coordinatorUrl,
      owner: userId,
      boardName,
    });
    if (await copyToClipboard(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[560px] flex flex-col gap-4">
        <DialogTitle className="text-lg font-semibold tracking-widest">
          Members
        </DialogTitle>
        <p className="text-sm text-muted-foreground -mt-2">
          People “{boardName}” is shared with. They sign in with the address you
          list, see the board’s facade and nothing else of it, and appear to
          each other under the name you give them — never by address.
        </p>

        <div className="flex flex-col gap-1" aria-label="Members">
          {members === null ? (
            <p className="text-sm text-muted-foreground py-2">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Not shared with anybody yet.
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.email}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  {editing === member.email ? (
                    <Input
                      autoFocus
                      aria-label={`Name for ${member.email}`}
                      // text-base: ≥16px, so a phone does not zoom on focus.
                      className="font-menu text-base h-8"
                      value={editedName}
                      onChange={(ev) => setEditedName(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          ev.preventDefault();
                          void rename(member);
                        }
                        if (ev.key === "Escape") {
                          setEditing(null);
                        }
                      }}
                      onBlur={() => void rename(member)}
                      spellCheck={false}
                    />
                  ) : (
                    <div className="text-sm font-medium truncate">
                      {member.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {member.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title="Change the name"
                  aria-label={`Rename ${member.email}`}
                  onClick={() => {
                    setEditing(member.email);
                    setEditedName(member.name);
                  }}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title="Stop sharing with them. Whatever they have open closes."
                  aria-label={`Remove ${member.email}`}
                  onClick={() => void remove(member)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex gap-2">
            <Input
              aria-label="Email"
              type="email"
              className="font-menu text-base"
              placeholder="email@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              spellCheck={false}
              autoCapitalize="none"
            />
            <Input
              aria-label="Name"
              className="font-menu text-base"
              placeholder="Name shown to others"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  void add();
                }
              }}
              spellCheck={false}
            />
            <Button
              className="text-md"
              disabled={!canAdd}
              onClick={() => void add()}
            >
              Add
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="text-md"
            onClick={() => void copyLink()}
            title="A link to this board. It opens only for somebody on this list."
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="ml-2">{copied ? "Copied" : "Copy link"}</span>
          </Button>
          <Button className="text-md" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
