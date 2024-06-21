import React, { useContext, useState } from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/ui-components/primitives/navigation-menu";
import { cn } from "@/ui-components";
import { BoardCtx } from "@/BoardContext";
import EditorDialog from "../EditorDialog";
import {
  restoreBoardFromLocalStorage,
  storeBoardToLocalStorage,
} from "@/views/playground/common";

export default function BoardMenu() {
  const boardContext = useContext(BoardCtx);
  const board = boardContext?.boardName;
  const [showBoardSource, setShowBoardSource] = useState(false);

  const onEditBoardSource = async () => {
    if (boardContext && board) {
      const src = boardContext.errorOnFetch
        ? restoreBoardFromLocalStorage(board)
        : await boardContext?.serializeBoard();
      setBoardSource(JSON.stringify(src, null, 2));
      setShowBoardSource(true);
    }
  };

  const onCloseBoardSource = () => setShowBoardSource(false);
  const onApplyBoardSource = (newSource: string) => {
    const src = JSON.parse(newSource);
    boardContext?.setBoardState(src);
    onCloseBoardSource();
  };

  const [boardSource, setBoardSource] = useState("");

  const onSaveBoardSource = (newSource: string) => {
    if (board) {
      storeBoardToLocalStorage(board, newSource);
    }
  };

  const onDownloadButton = (src: string) => {
    const dataUrl = "data:text/json;charset=utf-8," + encodeURIComponent(src);
    const link = document.createElement("a");
    const filename = `hkp-board-${board}.json`;
    link.setAttribute("href", dataUrl);
    link.setAttribute("download", filename);
    link.click();
  };

  const onCreateBoardLink = () => {
    boardContext?.onAction({
      type: "createBoardLink",
    });
  };

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
        ]}
      />
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            id="board-menu-trigger"
            className="px-2 tracking-wider text-sm hover:text-white text-base capitalize "
          >
            <div className="min-w-[30px] max-w-[130px] overflow-x-hidden text-ellipsis whitespace-nowrap">
              {board || "Board"}
            </div>
          </NavigationMenuTrigger>
          <NavigationMenuContent className="font-menu">
            <ul className="grid gap-3 p-6 w-[200px] md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              <ListItem
                title="New Board"
                onClick={() =>
                  boardContext?.onAction({
                    type: "newBoard",
                  })
                }
              >
                Create a new board.
              </ListItem>
              <ListItem
                title="Clear Board"
                onClick={() =>
                  boardContext?.onAction({
                    type: "clearBoard",
                  })
                }
                disabled={
                  !boardContext ||
                  !boardContext.isActionAvailable({ type: "clearBoard" })
                }
              >
                Clear the current Board
              </ListItem>
              <ListItem
                title="Save Board as"
                onClick={() =>
                  boardContext?.onAction({
                    type: "saveBoard",
                  })
                }
              >
                Save the current board to the browser
              </ListItem>
              <ListItem title="Edit Board Source" onClick={onEditBoardSource}>
                Edit the current board's source in a text editor
              </ListItem>
              <ListItem title="Create Board Link" onClick={onCreateBoardLink}>
                Create a link or QR code allowing to share and clone the board
                on another device
              </ListItem>
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
            className
          )}
          {...props}
        >
          <div className="text-base font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug  hover:text-accent-foreground">
            {children}
          </p>
        </div>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
