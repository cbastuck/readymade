import { useCallback, useEffect, useMemo, useState } from "react";

import Playground from "hkp-frontend/src/views/playground";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";
import { RemoteRuntimeStore } from "hkp-frontend/src/ui-components/toolbar/useRemoteRuntimeEditing";

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
import { BoardSnapshot } from "hkp-frontend/src/core/boardSnapshots";
import Board from "./Board";
import { SharePayload } from "./share/shareInbox";
import BoardShareConsumer from "./share/BoardShareConsumer";
import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { BoardDescriptor, RuntimeClass } from "hkp-frontend/src/types";

const isBuiltInRemote = (url?: string) =>
  (url || "").startsWith("hkp://remotes/");

type Props = {
  initialBoard?: BoardDescriptor | null;
  /** Where `initialBoard` was read from, when it came from a file. */
  boardFilePath?: string;
  /**
   * The unit documents `initialBoard` was resumed with, keyed by `uri`. A
   * session has no file path to resolve its units against; these are what it
   * has instead.
   */
  unitDocuments?: Record<string, BoardDescriptor>;
  onLogo: () => void;
  /** A captured share to inject at the board's pipeline head (run once). */
  shareToInject?: SharePayload | null;
  /** Called after the share was injected, so the shell can promote the next. */
  onShareConsumed?: () => void;
};
export default function MeanderPlayground({
  initialBoard = null,
  boardFilePath,
  unitDocuments,
  onLogo,
  shareToInject = null,
  onShareConsumed,
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

  // Remotes edited on a board persist to the backend one change at a time.
  // Built-in remotes are the backend's own and are left alone; a saved remote
  // keeps the port it was registered with.
  const remoteRuntimeStore = useMemo<RemoteRuntimeStore>(() => {
    const save = async (runtime: RuntimeClass) => {
      if (isBuiltInRemote(runtime.url)) {
        return;
      }
      const existing = (remotes || []).find((r) => r.name === runtime.name);
      await saveRemote({
        name: runtime.name,
        url: runtime.url || "",
        port: existing?.port || 0,
        color: runtime.color,
      });
      await loadRemotes();
    };
    const remove = async (runtime: RuntimeClass) => {
      if (isBuiltInRemote(runtime.url)) {
        return;
      }
      await deleteRemote(runtime.name);
      await loadRemotes();
    };
    return {
      onAdd: (runtime) => void save(runtime),
      onUpdate: (runtime) => void save(runtime),
      onRemove: (runtime) => void remove(runtime),
    };
  }, [loadRemotes, remotes]);

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

  const onBoardSnapshot = async (snapshot: BoardSnapshot) => {
    const { documents, reason } = snapshot;
    const name = snapshot.boardName || boardName;
    if (!name) {
      return;
    }
    localStorage.setItem("lastActiveBoardName", name);
    // The documents, not the projection: a board is resumed by being opened,
    // and what is opened has to be a document. Stored flat, a composition comes
    // back declaring no units, so there is nothing left to link and the facades
    // its units contribute are gone — the board is there, its faces are not.
    //
    // A configuration snapshot is labelled apart so the history keeps one of
    // them in a row rather than fifty: the backend replaces a "config" entry at
    // the head with the next one, and a structural change starts a new entry.
    const entry: BoardHistoryEntry = {
      timestamp: new Date().toISOString(),
      label: reason === "configuration" ? "config" : "auto",
      snapshot: { ...documents.composition, boardName: name },
      ...(documents.units.length ? { units: documents.units } : {}),
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
      boardSource={boardFilePath}
      unitDocuments={unitDocuments}
      availableRuntimeEngines={availableRuntimeEngines}
      remoteRuntimeStore={remoteRuntimeStore}
      onSaveBoard={onSaveBoard}
      onNewBoard={onNewBoard}
      onChangeBoardname={setBoardName}
      onUpdateBoardState={onUpdatedBoard}
      onBoardSnapshot={onBoardSnapshot}
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
      <BoardShareConsumer
        payload={shareToInject}
        onConsumed={onShareConsumed ?? (() => {})}
      />
    </Playground>
  );
}
