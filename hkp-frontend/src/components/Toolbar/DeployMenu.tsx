import { useContext, useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import {
  CoordinatorDescriptor,
  restoreCoordinators,
} from "hkp-frontend/src/common";
import { listCoordinatorBoards } from "hkp-frontend/src/views/cloud/coordinatorClient";
import { deployBoard } from "hkp-frontend/src/core/deploy";

/**
 * The toolbar's deploy control: hands the board being built to a coordinator.
 *
 * Boards are built here, where this browser owns the runtimes and closing the
 * tab takes them with it. Deploying gives that ownership to a coordinator,
 * which provisions the runtimes itself and keeps the board running with nobody
 * watching. The board is then opened in the cloud view — attached, not owned —
 * because the two views are exactly that distinction.
 */

const menuItemStyle: React.CSSProperties = {
  outline: "none",
  borderRadius: 6,
  padding: "7px 10px",
  userSelect: "none",
};

const itemTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text, #1a1a1a)",
  lineHeight: 1.3,
};

const itemHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-dim, #9ca3af)",
  marginTop: 1,
  lineHeight: 1.4,
};

export default function DeployMenu() {
  const boardContext = useContext(BoardCtx);
  const navigate = useNavigate();
  const user = boardContext?.appContext?.user;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coordinators, setCoordinators] = useState<CoordinatorDescriptor[]>([]);
  /** Coordinator URLs that already run a board under this name — deploying
   *  there replaces it, which the menu says before it happens. */
  const [replacing, setReplacing] = useState<Set<string>>(new Set());

  const boardName = boardContext?.boardName;

  useEffect(() => {
    if (!open) {
      return;
    }
    setCoordinators(restoreCoordinators());
  }, [open]);

  useEffect(() => {
    if (!open || !user || !boardName || coordinators.length === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
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
            // will report its real problem when it is deployed to.
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
      boardContext.appContext?.pushNotification({
        type: "success",
        message: `“${name}” is running on ${coordinator.name}`,
      });
      navigate("/cloud-boards", {
        state: {
          openBoard: {
            coordinatorUrl: coordinator.url,
            boardName: name,
            at: Date.now(),
          },
        },
      });
    } catch (err) {
      boardContext.appContext?.pushNotification({
        type: "error",
        message:
          err instanceof Error && err.message
            ? `Deploy failed — ${err.message}`
            : "Deploy failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const disabled = !boardContext || busy;

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          title={user ? "Deploy to a coordinator" : "Log in to deploy"}
          disabled={disabled}
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: "none",
            background: "none",
            cursor: disabled ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text, #1a1a1a)",
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <Rocket size={16} strokeWidth={1.75} />
        </button>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          style={{
            zIndex: 200,
            minWidth: 250,
            background: "var(--bg-card, white)",
            border: "1px solid var(--border-mid, #e2ddd7)",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
            padding: 5,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {/* Where the board runs right now, said plainly: the two views are
              the two answers, and this is the moment the user changes it. */}
          <div style={{ ...menuItemStyle, paddingBottom: 4 }}>
            <div style={itemTitleStyle}>Runs in this browser</div>
            <div style={itemHintStyle}>
              Closing the tab stops it. Deploy it to keep it running:
            </div>
          </div>

          {!user && (
            <div style={{ ...menuItemStyle, ...itemHintStyle }}>
              Log in to deploy this board.
            </div>
          )}

          {user && coordinators.length === 0 && (
            <DropdownMenuPrimitive.Item
              className="hkp-board-menu-item"
              style={{ ...menuItemStyle, cursor: "pointer" }}
              onSelect={() => navigate("/cloud-boards")}
            >
              <div style={itemTitleStyle}>Add a coordinator…</div>
              <div style={itemHintStyle}>
                A board needs somewhere to run once it leaves this browser
              </div>
            </DropdownMenuPrimitive.Item>
          )}

          {user &&
            coordinators.map((coordinator) => (
              <DropdownMenuPrimitive.Item
                key={coordinator.url}
                className="hkp-board-menu-item"
                disabled={busy}
                style={{
                  ...menuItemStyle,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.5 : 1,
                }}
                onSelect={() => void deploy(coordinator)}
              >
                <div style={itemTitleStyle}>{coordinator.name}</div>
                <div style={itemHintStyle}>
                  {replacing.has(coordinator.url)
                    ? `Replaces the board already running there`
                    : coordinator.url}
                </div>
              </DropdownMenuPrimitive.Item>
            ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
