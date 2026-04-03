import { BoardDescriptor } from "hkp-frontend/src/types";
import { BoardMenuItem } from "hkp-frontend/src/types";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { Remote } from "./types";

export async function loadBoard(boardName: string): Promise<BoardDescriptor> {
  const response = await fetch(`hkp://boards/${boardName}`);
  if (!response.ok) {
    throw new Error(`Failed to load board: ${response.statusText}`);
  }
  const board = await response.json();
  // TODO: make sure it is a valid board descriptor
  return board.boardName ? board : { ...board, boardName };
}

export async function deleteBoard(name: string) {
  const response = await fetch(`hkp://boards/${name}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete board: ${response.statusText}`);
  }
  return response.json();
}

export async function saveBoard(name: string, payload: BoardDescriptor) {
  const response = await fetch(`hkp://boards/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to save board: ${response.statusText}`);
  }
}

export async function getRemotes() {
  const res = await fetch("hkp://remotes/");
  return await res.json();
}

export async function saveRemote(remote: Remote) {
  const response = await fetch("hkp://remotes/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(remote),
  });

  if (!response.ok) {
    throw new Error(`Failed to save remote: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteRemote(name: string) {
  const response = await fetch("hkp://remotes/", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete remote: ${response.statusText}`);
  }

  return response.json();
}

export function createMenuItems(
  setLoadBoardItems: (items: Array<string>) => void,
  setBoardSource: (source: string) => void,
) {
  return (boardContext: BoardContextState): Array<BoardMenuItem> => [
    {
      title: "New Board",
      description: "Create a new board.",
      onClick: () => {
        boardContext.onAction({
          type: "newBoard",
        });
      },
      disabled: false,
    },
    {
      title: "Clear Board",
      description: "Clear the current Board",
      onClick: () =>
        boardContext.onAction({
          type: "clearBoard",
        }),
      disabled:
        !boardContext ||
        !boardContext.isActionAvailable({ type: "clearBoard" }),
    },
    {
      title: "Load Board",
      description: "Restore a saved board",
      onClick: async () => {
        const items = await fetchSavedBoards();
        setLoadBoardItems(items);
      },
      disabled: false,
    },
    {
      title: "Edit Board Source",
      description: "Edit the current board's source in a text editor",
      onClick: async () => {
        const src = await boardContext?.serializeBoard();
        if (src) {
          setBoardSource(JSON.stringify(src, null, 2));
        }
      },
    },
    {
      title: "Save Board as",
      description: "Save current board to disc",
      onClick: () =>
        boardContext?.onAction({
          type: "saveBoard",
        }),
      disabled: false,
    },
  ];
}

export async function fetchSavedBoards(): Promise<Array<string>> {
  const boards = await fetch("hkp://boards/");
  const boardNames: Array<string> = await boards.json();
  // TODO: Validate the response
  return boardNames.map((boardName) => decodeURIComponent(boardName));
}
