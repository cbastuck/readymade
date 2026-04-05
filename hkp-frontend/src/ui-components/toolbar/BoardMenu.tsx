import React, { useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/navigation-menu";
import { cn } from "hkp-frontend/src/ui-components";
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

type Props = {
  menuItemFactory?: BoardMenuItemFactory;
};

export default function BoardMenu({ menuItemFactory }: Props) {
  const navigate = useNavigate();
  const boardContext = useContext(BoardCtx);
  const board = boardContext?.boardName;
  const [showBoardSource, setShowBoardSource] = useState(false);

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
    boardContext?.setBoardState(src as BoardDescriptor); // TODO: validation
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
    boardContext?.onAction({
      type: "createBoardLink",
    });
  }, [boardContext]);

  const onRefineBoardWithAI = useCallback(async () => {
    if (!boardContext || !board) {
      return;
    }

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

    saveWorkflowRefinementSeed({
      sourceBoardName: board,
      baseBoardSource: JSON.stringify(src, null, 2),
      createdAt: new Date().toISOString(),
      initialPrompt:
        "Refine the current board. Keep existing behavior unless requested, and only change what is necessary.",
    });

    const templateBoard = createWorkflowRefinerTemplateBoard();
    storeBoardToLocalStorage(
      WORKFLOW_REFINER_TEMPLATE_BOARD_NAME,
      JSON.stringify(templateBoard, null, 2),
      templateBoard.description,
    );

    boardContext.appContext?.pushNotification({
      type: "info",
      message: "Opened AI Refiner template with current board as base input",
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
              onClick: () =>
                boardContext?.onAction({
                  type: "newBoard",
                }),
              disabled: false,
            },
            {
              title: "Clear Board",
              description: "Clear the current Board",
              onClick: () =>
                boardContext?.onAction({
                  type: "clearBoard",
                }),
              disabled:
                !boardContext ||
                !boardContext.isActionAvailable({ type: "clearBoard" }),
            },
            {
              title: "Save Board as",
              description: "Save the current board to the browser",
              onClick: () =>
                boardContext?.onAction({
                  type: "saveBoard",
                }),
              disabled: false,
            },
            {
              title: "Edit Board Source",
              description: "Edit the current board's source in a text editor",
              onClick: onEditBoardSource,
            },
            {
              title: "Create Board Link",
              description:
                "Create a link or QR code allowing to share and clone the board on another device",
              onClick: onCreateBoardLink,
            },
            {
              title: "Refine Board With AI",
              description:
                "Open the AI refiner template and inject this board JSON as the refinement base.",
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

  if (!board) {
    return null;
  }

  return (
    <NavigationMenu delayDuration={10000}>
      <EditorDialog
        title="Board Configuration"
        isOpen={showBoardSource}
        value={boardSource}
        onClose={onCloseBoardSource}
        actions={[
          {
            label: "Apply Changes",
            onAction: onApplyBoardSource,
          },
          {
            label: "Save to Browser",
            onAction: onSaveBoardSource,
          },
          {
            label: "Download Source",
            onAction: onDownloadButton,
          },
          {
            label: "Create share link",
            onAction: onCreateShareLinkFromSource,
          },
        ]}
      />
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            id="board-menu-trigger"
            className="px-2 hover:text-white data-[state=open]:text-white text-base-plus capitalize tracking-wider bg-transparent"
          >
            <div className="min-w-[30px] max-w-[130px] overflow-x-hidden text-ellipsis whitespace-nowrap text-base-plus tracking-wider">
              {board || "Board"}
            </div>
          </NavigationMenuTrigger>
          <NavigationMenuContent className="font-menu">
            <h3 className="px-3 my-[4px] text-sky-600">{board}</h3>
            <hr />
            <ul className="grid gap-1 w-[200px] md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr] m-1">
              {menuItems.map((item) => (
                <ListItem
                  key={item.title}
                  title={item.title}
                  onClick={item.onClick}
                  disabled={item.disabled}
                >
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { disabled?: boolean }
>(({ className, title, children, disabled, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <div
          ref={ref}
          className={cn(
            "cursor-pointer block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className,
          )}
          {...props}
        >
          <div className="text-base leading-none underline">{title}</div>
          <p className="line-clamp-2 text-[0.8rem] leading-snug  hover:text-accent-foreground">
            {children}
          </p>
        </div>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
