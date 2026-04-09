import { BoardDescriptor } from "hkp-frontend/src/types";
import { BoardMenuItem } from "hkp-frontend/src/types";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import {
  createWorkflowRefinerTemplateBoard,
  saveWorkflowRefinementSeed,
} from "hkp-frontend/src/runtime/browser/services/workflow-prompt/RefinementSession";
import { DEFAULT_GENERATED_BOARD } from "hkp-frontend/src/runtime/browser/services/workflow-prompt/DefaultWorkflowBoard";
import { Remote } from "./types";
import { getBackend } from "./backend";

export const loadBoard = (boardName: string): Promise<BoardDescriptor> =>
  getBackend().loadBoard(boardName);

export const deleteBoard = (name: string): Promise<void> =>
  getBackend().deleteBoard(name);

export const saveBoard = (name: string, payload: BoardDescriptor): Promise<void> =>
  getBackend().saveBoard(name, payload);

export const getRemotes = (): Promise<Array<Remote>> =>
  getBackend().getRemotes();

export const saveRemote = (remote: Remote): Promise<void> =>
  getBackend().saveRemote(remote);

export const deleteRemote = (name: string): Promise<void> =>
  getBackend().deleteRemote(name);

export const fetchSavedBoards = (): Promise<Array<string>> =>
  getBackend().fetchSavedBoards();

function isBoardDescriptorEmpty(board: any): boolean {
  if (!board || typeof board !== "object") {
    return true;
  }

  const runtimes = Array.isArray(board.runtimes) ? board.runtimes : [];
  if (runtimes.length > 0) {
    return false;
  }

  const services = board.services;
  if (!services || typeof services !== "object") {
    return true;
  }

  for (const runtimeId of Object.keys(services)) {
    const runtimeServices = services[runtimeId];
    if (Array.isArray(runtimeServices) && runtimeServices.length > 0) {
      return false;
    }
  }

  return true;
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
      title: "Board Refiner",
      description:
        "Refine or Build a board using the Workflow Builder using AI",
      onClick: async () => {
        const src = await boardContext?.serializeBoard();
        if (!src) {
          boardContext?.appContext?.pushNotification({
            type: "error",
            message: "Could not serialize board for AI refinement",
          });
          return;
        }

        const boardIsEmpty = isBoardDescriptorEmpty(src);
        const seedSource = boardIsEmpty ? DEFAULT_GENERATED_BOARD : src;
        const seedSourceName = boardIsEmpty
          ? "Hello World Example"
          : boardContext.boardName || "Board";

        saveWorkflowRefinementSeed({
          sourceBoardName: seedSourceName,
          baseBoardSource: JSON.stringify(seedSource, null, 2),
          createdAt: new Date().toISOString(),
          initialPrompt: boardIsEmpty
            ? "Start from the provided Hello World board and refine it. Keep existing behavior unless requested, and only change what is necessary."
            : "Refine the current board. Keep existing behavior unless requested, and only change what is necessary.",
        });

        const templateBoard = createWorkflowRefinerTemplateBoard();
        await boardContext?.setBoardState(templateBoard);

        boardContext?.appContext?.pushNotification({
          type: "info",
          message: boardIsEmpty
            ? "AI refiner loaded with Hello World example as base input (current board is empty)"
            : "AI refiner loaded with current board as base input",
        });
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

