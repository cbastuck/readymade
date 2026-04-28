import { useCallback, useEffect, useMemo, useState } from "react";

import Playground from "hkp-frontend/src/views/playground";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";

import { Remote } from "./types";
import MeanderAppMenu from "./MeanderAppMenu";
import {
  getRemotes,
  saveBoard,
  createMenuItems,
  deleteRemote,
  saveRemote,
} from "./actions";
import { getBackend } from "./backend";
import { BoardHistoryEntry } from "./backend/types";
import Board from "./Board";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import {
  BoardDescriptor,
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";

const isBuiltInRemote = (url?: string) =>
  (url || "").startsWith("hkp://remotes/");

type Props = {
  initialBoard?: BoardDescriptor | null;
  onLogo: () => void;
};
export default function MeanderPlayground({
  initialBoard = null,
  onLogo,
}: Props) {
  const [boardName, setBoardName] = useState("Idea");
  const [remotes, setRemotes] = useState<Array<Remote> | null>(null);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [boardSource, setBoardSource] = useState("");

  const loadRemotes = useCallback(async () => {
    setRemotes(await getRemotes());
  }, []);

  useEffect(() => {
    loadRemotes();
  }, [loadRemotes]);

  const availableRuntimeEngines = useMemo(() => {
    return [
      {
        type: "browser",
        name: "Browser Runtime",
      },
      ...(remotes || []).map((remote: Remote) => {
        return {
          type: "rest",
          name: remote.name,
          url: remote.url,
          color: remote.color,
          description: isBuiltInRemote(remote.url)
            ? `Local runtime proxy at ${remote.url}`
            : `Runtime engine at ${remote.url}${remote.port ? ` with port ${remote.port}` : ""}`,
        };
      }),
    ];
  }, [remotes]);

  const syncAvailableRuntimeEngines = useCallback(
    async (runtimeClasses: Array<RuntimeClass>) => {
      const currentRemotes = (remotes || []).filter(
        (remote) => !isBuiltInRemote(remote.url),
      );

      const desiredRemotes: Array<Remote> = runtimeClasses
        .filter(
          (runtime) =>
            (isRuntimeGraphQLClassType(runtime.type) ||
              isRuntimeRestClassType(runtime.type)) &&
            !isBuiltInRemote(runtime.url),
        )
        .map((runtime) => {
          const existingRemote = currentRemotes.find(
            (remote) => remote.name === runtime.name,
          );

          return {
            name: runtime.name,
            url: runtime.url || "",
            port: existingRemote?.port || 0,
            color: runtime.color,
          };
        });

      const desiredNames = new Set(desiredRemotes.map((remote) => remote.name));
      const removedRemotes = currentRemotes.filter(
        (remote) => !desiredNames.has(remote.name),
      );

      await Promise.all(desiredRemotes.map((remote) => saveRemote(remote)));
      await Promise.all(
        removedRemotes.map((remote) => deleteRemote(remote.name)),
      );
      await loadRemotes();
    },
    [loadRemotes, remotes],
  );

  const onCloseBoardSource = () => setBoardSource("");

  const menuItemFactory = useMemo(
    () => createMenuItems(() => setIsLoadDialogOpen(true), setBoardSource),
    [],
  );

  const onUpdatedBoard = (ctx: BoardContextState) =>
    setBoardName((boardName) => ctx.boardName || boardName);

  const onNewBoard = (ctx: BoardContextState) => {
    const newBoardName = "Idea";
    setBoardName(newBoardName);
    ctx.clearBoard(newBoardName);
  };

  const onSaveBoard = async (name: string, payload: BoardDescriptor) => {
    saveBoard(name, payload);
    setBoardName(name);
  };

  const onBoardInfrastructureChange = async (board: BoardDescriptor) => {
    const name = board.boardName || boardName;
    if (!name) {
      return;
    }
    localStorage.setItem("lastActiveBoardName", name);
    const entry: BoardHistoryEntry = {
      timestamp: new Date().toISOString(),
      label: "auto",
      snapshot: board,
    };
    try {
      await (await getBackend()).pushBoardSnapshot(name, entry);
    } catch {
      // Non-critical: history push failures are silently ignored.
    }
  };

  const onBoardLoaded = (board: BoardDescriptor) => {
    if (board.boardName) {
      localStorage.setItem("lastActiveBoardName", board.boardName);
    }
  };

  const logoSlot = (
    <Button
      variant="ghost"
      className="pl-[4px] ml-[4px] mr-[0px] pr-0 hover:drop-shadow-2xl"
      asChild
      onClick={onLogo}
    >
      <div className="px-[8px]">
        <IconH
          className="stroke-[#333] hover:stroke-sky-600"
          width={24}
          height={24}
        />
      </div>
    </Button>
  );

  return (
    <Playground
      boardName={boardName}
      boardDescriptor={initialBoard}
      availableRuntimeEngines={availableRuntimeEngines}
      onUpdateAvailableRuntimeEngines={syncAvailableRuntimeEngines}
      onSaveBoard={onSaveBoard}
      onNewBoard={onNewBoard}
      onChangeBoardname={setBoardName}
      onUpdateBoardState={onUpdatedBoard}
      onBoardInfrastructureChange={onBoardInfrastructureChange}
      menuItemFactory={menuItemFactory}
      hideNavigation
      menuSlot={<MeanderAppMenu />}
      logoSlot={logoSlot}
    >
      <Board
        boardSource={boardSource}
        isLoadDialogOpen={isLoadDialogOpen}
        onCloseBoardSource={onCloseBoardSource}
        onSetLoadDialogOpen={setIsLoadDialogOpen}
        onBoardLoaded={onBoardLoaded}
      />
    </Playground>
  );
}
