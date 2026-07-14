import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppContext } from "../../AppContext";
import { CoordinatorDescriptor, restoreCoordinators } from "../../common";
import {
  CoordinatorBoardInfo,
  listCoordinatorBoards,
} from "../cloud/coordinatorClient";
import { BoardNode, FolderNode } from "./types";

type CoordinatorState = {
  boards?: CoordinatorBoardInfo[];
  error?: boolean;
  loading?: boolean;
};

function boardNode(coordinatorUrl: string, board: CoordinatorBoardInfo): BoardNode {
  return {
    type: "board",
    name: board.boardName,
    state: board.status === "running" ? "running" : "needs-input",
    sub: board.status === "running" ? "Running in cloud" : "Failed to start",
    // Reuse the existing cloud action; the host opens it in the Cloud Boards
    // view (the same live coordinator session the toolbar icon uses).
    action: { kind: "cloud", coordinatorUrl, boardName: board.boardName },
  };
}

/**
 * The "Cloud Boards" source: each configured coordinator is a sub-folder whose
 * children are the boards registered on it. Mirrors the Cloud Boards view
 * (coordinators → boards), so the start page surfaces the same thing without a
 * detour through "+ Create Board". Login-gated — coordinators are read from
 * localStorage but listing their boards needs the cloud login. Returns null
 * when disabled, so the source is omitted entirely.
 *
 * Each coordinator row exposes a manual refresh, since a board's cloud status
 * (running / failed) can change without any signal to us.
 */
export function useCloudBoardsFolder(enabled: boolean): FolderNode | null {
  const { user } = useAppContext();
  const [coordinators, setCoordinators] = useState<CoordinatorDescriptor[]>([]);
  const [byCoordinator, setByCoordinator] = useState<
    Record<string, CoordinatorState>
  >({});

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCoordinators(enabled ? restoreCoordinators() : []);
  }, [enabled]);

  const urlsKey = coordinators.map((c) => c.url).join("|");

  const fetchCoordinator = useCallback(
    async (coordinator: CoordinatorDescriptor) => {
      if (!user) {
        return;
      }
      setByCoordinator((prev) => ({
        ...prev,
        [coordinator.url]: { boards: prev[coordinator.url]?.boards, loading: true },
      }));
      try {
        const boards = await listCoordinatorBoards(
          coordinator.url,
          user.userId,
          user.idToken,
        );
        if (mountedRef.current) {
          setByCoordinator((prev) => ({ ...prev, [coordinator.url]: { boards } }));
        }
      } catch {
        if (mountedRef.current) {
          setByCoordinator((prev) => ({
            ...prev,
            [coordinator.url]: { error: true },
          }));
        }
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user || coordinators.length === 0) {
      setByCoordinator({});
      return;
    }
    coordinators.forEach((coordinator) => void fetchCoordinator(coordinator));
    // coordinators captured; urlsKey/fetchCoordinator (user) drive the refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, fetchCoordinator, user]);

  const folder = useMemo<FolderNode>(() => {
    if (!user) {
      return {
        type: "folder",
        name: "Cloud Boards",
        source: true,
        children: [],
        emptyHint: "Log in to see your cloud boards",
      };
    }
    const children = coordinators.map<FolderNode>((coordinator) => {
      const state = byCoordinator[coordinator.url];
      const boards = (state?.boards ?? []).map((board) =>
        boardNode(coordinator.url, board),
      );
      return {
        type: "folder",
        name: coordinator.name || coordinator.url,
        children: boards,
        emptyHint: state?.loading
          ? "Loading…"
          : state?.error
            ? "Unreachable — check the coordinator"
            : state
              ? "No cloud boards yet"
              : "Loading…",
        onRefresh: () => void fetchCoordinator(coordinator),
        refreshing: state?.loading ?? false,
      };
    });
    return {
      type: "folder",
      name: "Cloud Boards",
      source: true,
      children,
      emptyHint:
        coordinators.length === 0 ? "No coordinators configured" : undefined,
    };
  }, [user, coordinators, byCoordinator, fetchCoordinator]);

  return enabled ? folder : null;
}
