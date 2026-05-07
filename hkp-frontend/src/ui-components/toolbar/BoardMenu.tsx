import { useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import EditorDialog from "../EditorDialog";
import {
  restoreBoardFromLocalStorage,
  storeBoardToLocalStorage,
} from "hkp-frontend/src/views/playground/common";
import { createBoardLink } from "hkp-frontend/src/views/playground/BoardLink";
import { assureJSON, stringifyIfNeeded } from "hkp-frontend/src/common";
import {
  BoardDescriptor,
  BoardMenuItem,
  BoardMenuItemFactory,
} from "hkp-frontend/src/types";
import {
  createWorkflowRefinerTemplateBoard,
  saveWorkflowRefinementSeed,
  WORKFLOW_REFINER_TEMPLATE_BOARD_NAME,
} from "hkp-frontend/src/runtime/browser/services/workflow-prompt/RefinementSession";
import {
  DEFAULT_GENERATED_BOARD,
  isBoardDescriptorEmpty,
} from "hkp-frontend/src/runtime/browser/services/workflow-prompt/DefaultWorkflowBoard";

type Props = {
  menuItemFactory?: BoardMenuItemFactory;
};

export default function BoardMenu({ menuItemFactory }: Props) {
  const navigate = useNavigate();
  const boardContext = useContext(BoardCtx);
  const board = boardContext?.boardName;
  const [showBoardSource, setShowBoardSource] = useState(false);
  const [open, setOpen] = useState(false);

  const onEditBoardSource = useCallback(async () => {
    if (boardContext && board) {
      const src = boardContext.errorOnFetch
        ? restoreBoardFromLocalStorage(board)
        : await boardContext?.serializeBoard();
      setBoardSource(JSON.stringify(src, null, 2));
      setShowBoardSource(true);
    }
  }, [boardContext, board]);

  const onCloseBoardSource = () => setShowBoardSource(false);
  const onApplyBoardSource = (newSource: string | object) => {
    const src = assureJSON(newSource);
    boardContext?.setBoardState(src as BoardDescriptor);
    onCloseBoardSource();
  };

  const [boardSource, setBoardSource] = useState("");

  const onSaveBoardSource = (newSource: string | object) => {
    if (board) {
      storeBoardToLocalStorage(board, stringifyIfNeeded(newSource));
    }
  };

  const onDownloadButton = (src: string | object) => {
    const dataUrl =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(stringifyIfNeeded(src));
    const link = document.createElement("a");
    const filename = `hkp-board-${board}.json`;
    link.setAttribute("href", dataUrl);
    link.setAttribute("download", filename);
    link.click();
  };

  const onCreateShareLinkFromSource = (src: string | object) => {
    const url = createBoardLink(stringifyIfNeeded(src));
    navigator.clipboard.writeText(url);
    boardContext?.appContext?.pushNotification({
      type: "info",
      message: "Board URL copied to clipboard",
    });
  };

  const onCreateBoardLink = useCallback(() => {
    boardContext?.onAction({ type: "createBoardLink" });
  }, [boardContext]);

  const onRefineBoardWithAI = useCallback(async () => {
    if (!boardContext || !board) return;

    const src = boardContext.errorOnFetch
      ? restoreBoardFromLocalStorage(board)
      : await boardContext.serializeBoard();

    if (!src) {
      boardContext.appContext?.pushNotification({
        type: "error",
        message: "Could not serialize current board for AI refinement",
      });
      return;
    }

    const boardIsEmpty = isBoardDescriptorEmpty(src);
    const seedSource = boardIsEmpty ? DEFAULT_GENERATED_BOARD : src;
    const seedSourceName = boardIsEmpty ? "Hello World Example" : board;

    saveWorkflowRefinementSeed({
      sourceBoardName: seedSourceName,
      baseBoardSource: JSON.stringify(seedSource, null, 2),
      createdAt: new Date().toISOString(),
      initialPrompt: boardIsEmpty
        ? "Start from the provided Hello World board and refine it. Keep existing behavior unless requested, and only change what is necessary."
        : "Refine the current board. Keep existing behavior unless requested, and only change what is necessary.",
    });

    const templateBoard = createWorkflowRefinerTemplateBoard();
    storeBoardToLocalStorage(
      WORKFLOW_REFINER_TEMPLATE_BOARD_NAME,
      JSON.stringify(templateBoard, null, 2),
      templateBoard.description,
    );

    boardContext.appContext?.pushNotification({
      type: "info",
      message: boardIsEmpty
        ? "Opened AI Refiner with Hello World example as base input (current board is empty)"
        : "Opened AI Refiner template with current board as base input",
    });

    navigate(`/playground/${WORKFLOW_REFINER_TEMPLATE_BOARD_NAME}`);
  }, [boardContext, board, navigate]);

  const menuItems: Array<BoardMenuItem> = useMemo(
    () =>
      menuItemFactory && boardContext
        ? menuItemFactory(boardContext)
        : [
            {
              title: "New Board",
              description: "Create a new board.",
              onClick: () => boardContext?.onAction({ type: "newBoard" }),
              disabled: false,
            },
            {
              title: "Clear Board",
              description: "Clear the current board",
              onClick: () => boardContext?.onAction({ type: "clearBoard" }),
              disabled:
                !boardContext ||
                !boardContext.isActionAvailable({ type: "clearBoard" }),
            },
            {
              title: "Save Board as",
              description: "Save the current board to the browser",
              onClick: () => boardContext?.onAction({ type: "saveBoard" }),
              disabled: false,
            },
            {
              title: "Edit Board Source",
              description: "Edit the board's JSON source in a text editor",
              onClick: onEditBoardSource,
            },
            {
              title: "Refine Board With AI",
              description: "Open the AI refiner with this board as the base",
              onClick: onRefineBoardWithAI,
            },
          ],
    [
      menuItemFactory,
      boardContext,
      onCreateBoardLink,
      onEditBoardSource,
      onRefineBoardWithAI,
    ],
  );

  if (!board) return null;

  return (
    <>
      <EditorDialog
        title="Board Configuration"
        isOpen={showBoardSource}
        value={boardSource}
        onClose={onCloseBoardSource}
        actions={[
          { label: "Apply Changes", onAction: onApplyBoardSource },
          { label: "Save to Browser", onAction: onSaveBoardSource },
          { label: "Download Source", onAction: onDownloadButton },
          { label: "Create share link", onAction: onCreateShareLinkFromSource },
        ]}
      />

      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            id="board-menu-trigger"
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              maxWidth: 160,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {board}
            </span>
            <ChevronDown
              size={12}
              style={{
                flexShrink: 0,
                transition: "transform 0.18s ease",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
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
            {menuItems.map((item, i) => (
              <DropdownMenuPrimitive.Item
                key={item.title ?? i}
                disabled={item.disabled}
                onSelect={() => item.onClick?.()}
                style={{
                  outline: "none",
                  borderRadius: 6,
                  padding: "7px 10px",
                  cursor: item.disabled ? "default" : "pointer",
                  opacity: item.disabled ? 0.4 : 1,
                  userSelect: "none",
                }}
                className="hkp-board-menu-item"
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text, #1a1a1a)",
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </div>
                {item.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim, #9ca3af)",
                      marginTop: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.description}
                  </div>
                )}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </>
  );
}
