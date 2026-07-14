import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildMyBoardsFolder,
  defaultStartPageTree,
} from "./model";
import { buildDemosFolder } from "./demosSource";
import { useCloudFolder } from "./useCloudSource";
import { useCloudBoardsFolder } from "./useCloudBoardsFolder";
import { useRemotesFolder } from "./useRemotesFolder";
import { StartPageStore } from "./store";
import {
  BoardNode,
  BoardState,
  FolderNode,
  RemotesController,
  StartPageTree,
  TreeNode,
} from "./types";

export interface RuntimeEntry {
  name: string;
  url?: string;
}

export interface StartPageModelOptions {
  /** Persistence for the user's folder tree. */
  store: StartPageStore;
  /** Saved board names for "My Boards"; omit when the host has no storage. */
  listSavedBoards?: () => Promise<string[]>;
  /** Live board states keyed by board name (running / needs-input / …). */
  boardStates?: Record<string, BoardState>;
  /** Runtimes surfaced as a source folder (external instances). */
  runtimes?: RuntimeEntry[];
  /** Configured remotes; surfaced as a "Remotes" source that drills into the
   *  runtimes running on each server. Omit to hide the source. */
  remotes?: RemotesController;
  /** Show the Cloud source (requires AppContext + coordinators). */
  withCloud?: boolean;
  /** Show the "Cloud Boards" source: coordinators → their registered boards.
   *  Requires AppContext; login-gated. */
  cloudBoards?: boolean;
  /** Additional host-provided sources appended after the built-in ones. */
  extraSources?: FolderNode[];
  /** Virtual folders appended inside My Boards, after the user's own
   *  hierarchy (e.g. an "Uploaded" view of the user's cloud boards). */
  myBoardsExtraFolders?: FolderNode[];
  /** Demo entries with any of these tags are hidden (e.g. "iOS only"). */
  excludeDemoTags?: string[];
}

export interface StartPageModel {
  /** The persisted user tree; null until the store has loaded. */
  tree: StartPageTree | null;
  /** Applies and persists a new tree. */
  updateTree: (next: StartPageTree) => void;
  /** The view tree's root folders (Demos, My Boards, Cloud, …). */
  roots: TreeNode[];
  savedBoards: string[];
  refreshSavedBoards: () => void;
}

/**
 * The data layer shared by the desktop (column browser) and mobile
 * (drill-down) start pages: loads/persists the user's folder tree and builds
 * the source root folders from it plus the live host data.
 */
export function useStartPageModel(
  options: StartPageModelOptions,
): StartPageModel {
  const {
    store,
    listSavedBoards,
    boardStates,
    runtimes,
    remotes,
    withCloud,
    cloudBoards,
    extraSources,
    myBoardsExtraFolders,
    excludeDemoTags,
  } = options;

  const [tree, setTree] = useState<StartPageTree | null>(null);
  const [savedBoards, setSavedBoards] = useState<string[]>([]);

  useEffect(() => {
    void store.load().then((loaded) => setTree(loaded ?? defaultStartPageTree()));
  }, [store]);

  const refreshSavedBoards = useCallback(() => {
    if (listSavedBoards) {
      void listSavedBoards().then(setSavedBoards).catch(() => setSavedBoards([]));
    }
  }, [listSavedBoards]);

  useEffect(refreshSavedBoards, [refreshSavedBoards]);

  const updateTree = useCallback(
    (next: StartPageTree) => {
      setTree(next);
      void store.save(next);
    },
    [store],
  );

  const cloudFolder = useCloudFolder(withCloud === true);
  const cloudBoardsFolder = useCloudBoardsFolder(cloudBoards === true);
  const remotesFolder = useRemotesFolder(remotes);

  const roots = useMemo<TreeNode[]>(() => {
    const list: TreeNode[] = [];
    list.push(buildDemosFolder({ excludeTags: excludeDemoTags }));
    list.push(
      buildMyBoardsFolder(
        tree ?? defaultStartPageTree(),
        savedBoards,
        boardStates,
        myBoardsExtraFolders,
      ),
    );
    if (withCloud) {
      list.push(cloudFolder);
    }
    if (cloudBoardsFolder) {
      list.push(cloudBoardsFolder);
    }
    if (runtimes && runtimes.length > 0) {
      list.push({
        type: "folder",
        name: "Runtimes",
        source: true,
        children: runtimes.map<BoardNode>((rt) => ({
          type: "board",
          name: rt.name,
          state: "runtime",
          sub: rt.url ?? "Runtime",
          action: { kind: "runtime", name: rt.name },
        })),
      });
    }
    if (remotesFolder) {
      list.push(remotesFolder);
    }
    for (const source of extraSources ?? []) {
      list.push(source);
    }
    return list;
  }, [
    tree,
    savedBoards,
    boardStates,
    excludeDemoTags,
    withCloud,
    cloudFolder,
    cloudBoardsFolder,
    runtimes,
    remotesFolder,
    extraSources,
    myBoardsExtraFolders,
  ]);

  return { tree, updateTree, roots, savedBoards, refreshSavedBoards };
}
