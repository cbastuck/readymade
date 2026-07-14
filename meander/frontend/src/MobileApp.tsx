import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HkpApp from "hkp-frontend/src/App";
import MobilePlaygroundWithRouter from "hkp-frontend/src/views/playground/mobile/index";
import {
  MobileStartPage,
  localStorageStartPageStore,
  BoardAction,
  RemotesController,
  createEmptyBoard,
  initialsOf,
  splitBuildVersion,
  useCloudBoardSources,
} from "hkp-frontend/src/views/start";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import {
  getLocalBoards,
  localStoragePrefix,
  storeBoardToLocalStorage,
} from "hkp-frontend/src/views/playground/common";
import { findDemoBoard } from "hkp-frontend/src/demoRegistry";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { BoardDescriptor } from "hkp-frontend/src/types";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import RuntimeUserSync from "./RuntimeUserSync";
import { useBackendRemotes } from "./useBackendRemotes";
import {
  SharePayload,
  drainNextShare,
  mirrorBoardsToNative,
} from "./share/shareInbox";
import ShareBoardPicker from "./share/ShareBoardPicker";
import BoardShareConsumer from "./share/BoardShareConsumer";

// Boards on iOS live in the webview's localStorage (the same store the mobile
// playground's save sheet writes to), and so does the start-page folder tree.
const store = localStorageStartPageStore();
const buildVersion = splitBuildVersion(__READYMADE_BUILD_VERSION__);

/** What the playground should boot into; null shows the start page. */
type BoardSession = {
  name?: string;
  descriptor?: BoardDescriptor;
};

function StartScreen({
  onOpenSession,
  remotes,
}: {
  onOpenSession: (session: BoardSession) => void;
  remotes: RemotesController;
}) {
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const cloudLogout = useCloudLogout();

  const {
    sharedSource,
    uploadedFolders,
    uploadBoardToCloud,
    onRevokeShare,
    onLeaveShare,
    openCloudStored,
  } = useCloudBoardSources();

  const listSavedBoards = useCallback(
    async () => getLocalBoards().map((board) => board.name),
    [],
  );

  const describeBoard = useCallback(async (name: string) => {
    try {
      const raw = localStorage.getItem(`${localStoragePrefix}${name}`);
      return raw
        ? ((JSON.parse(raw) as { description?: string }).description ?? undefined)
        : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const deleteBoard = useCallback((name: string) => {
    localStorage.removeItem(`${localStoragePrefix}${name}`);
    // Deleting happens on the start page (no session change), so refresh the
    // share extension's board mirror here.
    mirrorBoardsToNative(getLocalBoards().map((board) => board.name));
  }, []);

  const handleCreateNamedBoard = (name: string) => {
    // Persist right away so the folder reference resolves on return.
    storeBoardToLocalStorage(name, JSON.stringify(createEmptyBoard(name)));
    onOpenSession({ name });
  };

  const handleOpen = (action: BoardAction) => {
    switch (action.kind) {
      case "saved":
        onOpenSession({ name: action.name });
        break;
      case "demo": {
        const board = findDemoBoard(action.slug);
        if (board) {
          onOpenSession({
            name: board.boardName ?? action.slug,
            descriptor: board,
          });
        }
        break;
      }
      case "cloud-stored":
        // Fetch the stored board and open it directly as a descriptor —
        // nothing is written locally until the user saves it themselves.
        void openCloudStored(action)
          .then((board) => {
            if (board) {
              onOpenSession({
                name: action.name,
                descriptor: board.data as unknown as BoardDescriptor,
              });
            }
          })
          .catch((err: unknown) => {
            console.error("Could not open the cloud board", err);
          });
        break;
      // No cloud-coordinator / runtime detail views in the iOS app yet.
      case "cloud":
      case "runtime":
        break;
    }
  };

  return (
    <MobileStartPage
      store={store}
      listSavedBoards={listSavedBoards}
      onOpen={handleOpen}
      onCreateBoard={() => onOpenSession({})}
      onCreateNamedBoard={handleCreateNamedBoard}
      describeBoard={describeBoard}
      onDeleteBoard={deleteBoard}
      uploadBoardToCloud={uploadBoardToCloud}
      extraSources={[sharedSource]}
      myBoardsExtraFolders={uploadedFolders}
      onRevokeShare={onRevokeShare}
      onLeaveShare={onLeaveShare}
      manageRemotes={remotes}
      title="Readymade"
      badge={buildVersion.version}
      badgeDetail={buildVersion.hash}
      initials={initialsOf(user?.username)}
      avatarTitle={
        user
          ? user.username
            ? `Log out (${user.username})`
            : "Log out"
          : "Log in"
      }
      onAvatarClick={() => void (user ? cloudLogout() : cloudLogin())}
    />
  );
}

export default function MobileApp() {
  const [session, setSession] = useState<BoardSession | null>(null);
  const remotes = useBackendRemotes();

  // Share feature: a share captured by the iOS share extension is delivered by
  // the native bridge, previewed in a picker, then injected into the board the
  // user chooses. `pendingShare` awaits a board choice; `shareToInject` is the
  // chosen-but-not-yet-consumed share the BoardShareConsumer runs once ready.
  const [pendingShare, setPendingShare] = useState<SharePayload | null>(null);
  const [shareToInject, setShareToInject] = useState<SharePayload | null>(null);
  // True while a share is in flight (picking or injecting), so newly delivered
  // shares queue on window.__READYMADE_SHARES__ instead of clobbering the UI.
  const shareActiveRef = useRef(false);

  const promoteNextShare = useCallback(() => {
    if (shareActiveRef.current) {
      return;
    }
    const next = drainNextShare();
    console.log(
      "[ReadymadeShare] promoteNextShare drained:",
      next ? next.url ?? next.text ?? next.id : "none",
      next?.boardName ? `→ board "${next.boardName}"` : "",
    );
    if (!next) {
      return;
    }
    shareActiveRef.current = true;
    const boards = getLocalBoards().map((board) => board.name);
    if (next.boardName && boards.includes(next.boardName)) {
      // Pre-tagged in the share extension's picker: skip the in-app picker and
      // run the board directly. Close any other open board first; the effect
      // below opens the target once the session is clear.
      setShareToInject(next);
      setSession((prev) => (prev?.name === next.boardName ? prev : null));
    } else {
      // Untagged (or the tagged board no longer exists): ask in-app.
      setPendingShare(next);
    }
  }, []);

  // Opens the pre-tagged board once no other board is open. Split from
  // promoteNextShare because closing a different board takes a render pass.
  useEffect(() => {
    if (shareToInject?.boardName && session === null) {
      setSession({ name: shareToInject.boardName });
    }
  }, [shareToInject, session]);

  // Keep the native share extension's board picker in sync: mirror the board
  // names whenever the user lands on the start page (which is also where
  // boards get created, renamed, and deleted).
  useEffect(() => {
    mirrorBoardsToNative(getLocalBoards().map((board) => board.name));
  }, [session]);

  useEffect(() => {
    // Native pushes each envelope onto the queue and then calls this; also
    // drain anything queued before mount (cold launch from the share sheet).
    window.__readymadeOnShare = promoteNextShare;
    promoteNextShare();
    return () => {
      if (window.__readymadeOnShare === promoteNextShare) {
        delete window.__readymadeOnShare;
      }
    };
  }, [promoteNextShare]);

  const shareBoards = useCallback(
    () => getLocalBoards().map((board) => board.name),
    [],
  );

  const handlePickShareBoard = useCallback(
    (name: string) => {
      // Keep shareActiveRef true through injection; released on consume.
      setShareToInject(pendingShare);
      setPendingShare(null);
      setSession({ name });
    },
    [pendingShare],
  );

  const handleCancelShare = useCallback(() => {
    shareActiveRef.current = false;
    setPendingShare(null);
    promoteNextShare();
  }, [promoteNextShare]);

  const handleShareConsumed = useCallback(() => {
    setShareToInject(null);
    shareActiveRef.current = false;
    promoteNextShare();
  }, [promoteNextShare]);

  const availableRuntimeEngines = useMemo(
    () => [
      { type: "browser", name: "Browser Runtime" },
      ...remotes.runtimes,
    ],
    [remotes.runtimes],
  );

  return (
    <MeanderPlatformProvider>
      <HkpApp defaultThemeName="playground">
        <RuntimeUserSync />
        {session === null ? (
          <StartScreen onOpenSession={setSession} remotes={remotes} />
        ) : (
          <MobilePlaygroundWithRouter
            boardName={session.name}
            boardDescriptor={session.descriptor}
            onChangeBoardname={(name: string) =>
              setSession((prev) => ({ ...prev, name }))
            }
            onNewBoard={() => setSession({})}
            onHome={() => setSession(null)}
            availableRuntimeEngines={availableRuntimeEngines}
          >
            <BoardShareConsumer
              payload={shareToInject}
              onConsumed={handleShareConsumed}
            />
          </MobilePlaygroundWithRouter>
        )}
        {pendingShare && (
          <ShareBoardPicker
            share={pendingShare}
            boards={shareBoards()}
            onPick={handlePickShareBoard}
            onCancel={handleCancelShare}
          />
        )}
      </HkpApp>
    </MeanderPlatformProvider>
  );
}
