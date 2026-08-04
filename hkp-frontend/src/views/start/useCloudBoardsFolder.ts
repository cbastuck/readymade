import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppContext } from "../../AppContext";
import { CoordinatorDescriptor, restoreCoordinators } from "../../common";
import {
  CoordinatorBoardInfo,
  listCoordinatorBoards,
} from "../cloud/coordinatorClient";
import { BoardNode, CoordinatorsController, FolderNode } from "./types";

type CoordinatorState = {
  boards?: CoordinatorBoardInfo[];
  error?: boolean;
  loading?: boolean;
};

/** Stopping a board is something the user did; only "error" is a failure. */
function statusLabel(status: CoordinatorBoardInfo["status"]): string {
  switch (status) {
    case "running":
      return "Running in cloud";
    case "stopped":
      return "Stopped";
    default:
      return "Failed to start";
  }
}

function boardNode(coordinatorUrl: string, board: CoordinatorBoardInfo): BoardNode {
  return {
    type: "board",
    name: board.boardName,
    state: board.status === "running" ? "running" : "needs-input",
    sub: statusLabel(board.status),
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
 *
 * A host that manages coordinators itself passes a controller: its list is
 * what the source shows — so an added coordinator appears at once — and its
 * manage action is offered at the foot of the column. Without one the stored
 * coordinators are read directly and the source stays read-only.
 */
export function useCloudBoardsFolder(
  enabled: boolean,
  controller?: CoordinatorsController,
): FolderNode | null {
  const { user } = useAppContext();
  const [stored, setStored] = useState<CoordinatorDescriptor[]>([]);
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

  // Only read the store when no controller holds the list; keyed on whether
  // there is one rather than on its (per-render) identity.
  const hostManaged = controller !== undefined;
  useEffect(() => {
    setStored(enabled && !hostManaged ? restoreCoordinators() : []);
  }, [enabled, hostManaged]);

  const coordinators = controller?.coordinators ?? stored;
  const onManage = controller?.onManage;

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
    // Configuring coordinators is independent of the login the board listing
    // needs, so the action is offered either way.
    const manageAction = onManage
      ? { label: "Manage coordinators", onClick: onManage }
      : undefined;
    if (!user) {
      return {
        type: "folder",
        name: "Cloud Boards",
        source: true,
        children: [],
        emptyHint: "Log in to see your cloud boards",
        action: manageAction,
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
      action: manageAction,
    };
  }, [user, coordinators, byCoordinator, fetchCoordinator, onManage]);

  return enabled ? folder : null;
}
