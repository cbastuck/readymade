import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HkpApp from "hkp-frontend/src/App";
// The app signs users in through Auth0's Native application (the RFC 8252 flow
// in iosLogin/meanderLogin), so that is the one the Auth0 client here is
// configured for.
import { AUTH0_CLIENT_ID } from "./auth/meanderLogin";
import MobilePlaygroundWithRouter from "hkp-frontend/src/views/playground/mobile/index";
import type { OpenCloudBoardSignal } from "hkp-frontend/src/views/cloud/mobile/MobileCloudBoards";
import {
  MobileStartPage,
  localStorageStartPageStore,
  BoardAction,
  PinsController,
  RemotesController,
  createEmptyBoard,
  initialsOf,
  splitBuildVersion,
  useCloudBoardSources,
  useLocalStorageCoordinators,
} from "hkp-frontend/src/views/start";
import { commitUrl } from "hkp-frontend/src/projectMeta";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { MobileAccountPage } from "hkp-frontend/src/views/profile";
import { useUserProfile } from "hkp-frontend/src/core/userProfile";
import {
  getLocalBoards,
  localStoragePrefix,
  storeBoardToLocalStorage,
} from "hkp-frontend/src/views/playground/common";
import { findDemoBoard } from "hkp-frontend/src/demoRegistry";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { BoardDescriptor } from "hkp-frontend/src/types";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import SecretConsentDialog from "./SecretConsentDialog";
import RuntimeUserSync from "./RuntimeUserSync";
import { useBackendRemotes } from "./useBackendRemotes";
import {
  SharePayload,
  drainNextShare,
  mirrorBoardsToNative,
} from "./share/shareInbox";
import ShareBoardPicker from "./share/ShareBoardPicker";
import BoardShareConsumer from "./share/BoardShareConsumer";
import { toast } from "hkp-frontend/src/ui-components/primitives/sonner";
import { openShortcutsApp, takeLaunch } from "./homeScreen/homeScreen";
import { usePins } from "./homeScreen/usePins";
import HomeScreenSheet from "./homeScreen/HomeScreenSheet";

// Boards on iOS live in the webview's localStorage (the same store the mobile
// playground's save sheet writes to), and so does the start-page folder tree.
const store = localStorageStartPageStore();
const buildVersion = splitBuildVersion(__READYMADE_BUILD_VERSION__);

/** What the playground should boot into; null shows the start page. */
type BoardSession = {
  name?: string;
  descriptor?: BoardDescriptor;
  /** Set when the session was opened to run a cloud board: the playground
   *  boots into its Cloud tab with that board hydrated. */
  cloudBoard?: OpenCloudBoardSignal;
};

function StartScreen({
  onOpenSession,
  onShowAccount,
  remotes,
  pins,
  onBoardDeleted,
}: {
  onOpenSession: (session: BoardSession) => void;
  onShowAccount: () => void;
  remotes: RemotesController;
  pins: PinsController;
  /** A deleted board cannot be launched any more: the host unpins it. */
  onBoardDeleted: (name: string) => void;
}) {
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  // The display name someone set on the account page, so the avatar shows the
  // same initials the account does.
  const profile = useUserProfile(user?.userId);
  const accountName = profile.displayName || user?.username;
  // Coordinators live in the webview's localStorage, like the boards — the
  // same list the playground's connections sheet and deploy menu read. No
  // onManage: the start page manages them in its own connections sheet.
  const coordinators = useLocalStorageCoordinators();

  const {
    sharedSource,
    uploadedFolders,
    uploadBoardToCloud,
    onRevokeShare,
    onLeaveShare,
    onDeleteCloudBoard,
    openCloudStored,
  } = useCloudBoardSources();

  const listSavedBoards = useCallback(
    async () =>
      // createdAt is written on every save, so it is the board's last-write
      // time — what the details panel and the "recent" sort want.
      getLocalBoards().map((board) => ({
        name: board.name,
        modified: board.createdAt,
      })),
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

  const deleteBoard = useCallback(
    (name: string) => {
      localStorage.removeItem(`${localStoragePrefix}${name}`);
      // Deleting happens on the start page (no session change), so refresh the
      // share extension's board mirror here.
      mirrorBoardsToNative(getLocalBoards().map((board) => board.name));
      onBoardDeleted(name);
    },
    [onBoardDeleted],
  );

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
      case "source":
        // Board text with no file behind it (a demo read in the source
        // editor): handed straight to the session, nothing is written until
        // the user saves it.
        onOpenSession({
          name: action.name,
          descriptor: JSON.parse(action.source) as BoardDescriptor,
        });
        break;
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
      case "cloud":
        // Cloud boards run in the playground's Cloud tab — open a session that
        // lands there with this board hydrated, rather than a local copy.
        onOpenSession({
          cloudBoard: {
            coordinatorUrl: action.coordinatorUrl,
            boardName: action.boardName,
            // Set on a board somebody shared: it opens as its member.
            owner: action.sharedBy,
            at: Date.now(),
          },
        });
        break;
      // Browsable from the start page's Remotes source, but nothing in the app
      // attaches to a remote runtime; canOpen below keeps the entry read-only
      // rather than dead.
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
      onDeleteCloudBoard={onDeleteCloudBoard}
      manageRemotes={remotes}
      withCloudBoards
      manageCoordinators={coordinators}
      pins={pins}
      canOpen={(action) => action.kind !== "runtime"}
      title="Readymade"
      badge={buildVersion.version}
      badgeDetail={buildVersion.hash}
      badgeDetailHref={commitUrl(buildVersion.hash)}
      initials={initialsOf(accountName)}
      avatarTitle={
        user ? (accountName ? `Account (${accountName})` : "Account") : "Log in"
      }
      onAvatarClick={() => (user ? onShowAccount() : void cloudLogin())}
    />
  );
}

export default function MobileApp() {
  const [session, setSession] = useState<BoardSession | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const remotes = useBackendRemotes();
  const { pins, unpinIfPinned, pinnedTitle, dismissPinned } = usePins();

  // A board launched from outside the app — the Home Screen, a widget, a
  // shortcut, a quick action. Opened the way a share opens its board: any
  // other board is closed first and the effect below opens this one once the
  // session is clear, so nothing of the previous board carries over.
  const [launchSession, setLaunchSession] = useState<BoardSession | null>(null);

  const openLaunch = useCallback(async () => {
    const target = await takeLaunch();
    if (!target) {
      return;
    }
    setShowAccount(false);
    let next: BoardSession | null = null;
    if (target.kind === "saved") {
      if (getLocalBoards().some((board) => board.name === target.id)) {
        next = { name: target.id };
      } else {
        toast.error(`“${target.id}” is no longer on this device`, {
          description: "It was deleted or renamed. Unpin it from its board's details.",
        });
      }
    } else {
      const board = findDemoBoard(target.id);
      if (board) {
        next = { name: board.boardName ?? target.id, descriptor: board };
      } else {
        toast.error("This demo is not part of this version of Readymade");
      }
    }
    if (!next) {
      setSession(null);
      return;
    }
    const opening = next;
    // The saved board already open stays as it is: launching it again is
    // coming back to it, not starting over.
    setSession((prev) =>
      opening.descriptor === undefined &&
      prev?.descriptor === undefined &&
      prev?.name === opening.name
        ? prev
        : null,
    );
    setLaunchSession(opening);
  }, []);

  useEffect(() => {
    if (launchSession && session === null) {
      setSession(launchSession);
      setLaunchSession(null);
    } else if (launchSession && session?.name === launchSession.name) {
      setLaunchSession(null);
    }
  }, [launchSession, session]);

  useEffect(() => {
    // The shell calls this when it is asked to open a board while the app
    // runs; on a cold start the board is already waiting, so take it now.
    window.__readymadeOnLaunch = () => void openLaunch();
    void openLaunch();
    return () => {
      delete window.__readymadeOnLaunch;
    };
  }, [openLaunch]);

  const handleBoardDeleted = useCallback(
    (name: string) => {
      void unpinIfPinned({ kind: "saved", name }).catch(() => {
        // The pin outlives the board; launching it says the board is gone.
      });
    },
    [unpinIfPinned],
  );

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
      const share = pendingShare;
      setPendingShare(null);
      if (!share) {
        return;
      }
      // Same deferred-open path as pre-tagged shares: close any other open
      // board first (the effect above opens the target once the session is
      // clear), so the share cannot run through the wrong board's pipeline.
      setShareToInject({ ...share, boardName: name });
      setSession((prev) => (prev?.name === name ? prev : null));
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
      <HkpApp defaultThemeName="playground" clientId={AUTH0_CLIENT_ID}>
        <RuntimeUserSync />
        <SecretConsentDialog />
        {session === null ? (
          <StartScreen
            onOpenSession={setSession}
            onShowAccount={() => setShowAccount(true)}
            remotes={remotes}
            pins={pins}
            onBoardDeleted={handleBoardDeleted}
          />
        ) : (
          <MobilePlaygroundWithRouter
            boardName={session.name}
            boardDescriptor={session.descriptor}
            openCloudBoard={session.cloudBoard}
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
        {/* Over whatever is showing, never instead of it: a board underneath
            is live state, and unmounting it to show an account would discard
            edits nobody agreed to lose. */}
        {showAccount && (
          <MobileAccountPage onBack={() => setShowAccount(false)} />
        )}
        {pinnedTitle && (
          <HomeScreenSheet
            title={pinnedTitle}
            onOpenShortcuts={() => void openShortcutsApp()}
            onClose={dismissPinned}
          />
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
