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
  BoardAction,
  BoardHistoryItem,
  BoardState,
  PinsController,
  PinTarget,
  RemotesController,
  createEmptyBoard,
  initialsOf,
  splitBuildVersion,
  useCloudBoardSources,
  useLocalStorageCoordinators,
} from "hkp-frontend/src/views/start";
import type { StartPageStore } from "hkp-frontend/src/views/start";
import { commitUrl } from "hkp-frontend/src/projectMeta";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { MobileAccountPage } from "hkp-frontend/src/views/profile";
import { useUserProfile } from "hkp-frontend/src/core/userProfile";
import { findDemoBoard, findDemoUnits } from "hkp-frontend/src/demoRegistry";
import { DEMO_CATALOG } from "hkp-frontend/src/demoCatalog";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { BoardDescriptor } from "hkp-frontend/src/types";
import { BoardSnapshot } from "hkp-frontend/src/core/boardSnapshots";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import SecretConsentDialog from "./SecretConsentDialog";
import MobileSettings from "./MobileSettings";
import RuntimeUserSync from "./RuntimeUserSync";
import { useBackendRemotes } from "./useBackendRemotes";
import { SharePayload, drainNextShare } from "./share/shareInbox";
import ShareBoardPicker from "./share/ShareBoardPicker";
import BoardShareConsumer from "./share/BoardShareConsumer";
import { toast } from "hkp-frontend/src/ui-components/primitives/sonner";
import {
  openShortcutsApp,
  opensAsApp,
  removePin,
  takeLaunch,
} from "./homeScreen/homeScreen";
import { usePins } from "./homeScreen/usePins";
import HomeScreenSheet from "./homeScreen/HomeScreenSheet";
import { getBackend } from "./backend";
import { migrateLocalBoards } from "./library/migrateLocalBoards";
import { deleteSavedBoard } from "./library/deleteBoard";
import {
  lastBoardName,
  recordSnapshot,
  resumeBoard,
  resumedFrom,
} from "./library/boardHistory";

const buildVersion = splitBuildVersion(__READYMADE_BUILD_VERSION__);

// Boards an older version kept in the webview's storage move into the library
// once, before anything lists or opens one. Started at most once per launch,
// however often the app renders.
let libraryMigration: Promise<void> | null = null;
function whenLibraryReady(): Promise<void> {
  libraryMigration ??= migrateLocalBoards().catch((err: unknown) => {
    console.error("Could not move the boards into the library", err);
  });
  return libraryMigration;
}

async function savedBoardNames(): Promise<string[]> {
  await whenLibraryReady();
  return (await getBackend()).fetchSavedBoards();
}

// Boards live in the app's own library (hkp://boards/: iCloud Drive or the
// app's Documents on iOS, app storage on Android), and the start page's folder
// tree beside it — never in the webview's storage, which the OS may clear.
const store: StartPageStore = {
  load: async () => {
    await whenLibraryReady();
    return (await getBackend()).loadStartPageTree();
  },
  save: async (tree) => (await getBackend()).saveStartPageTree(tree),
};

/** What the playground should boot into; null shows the start page. */
type BoardSession = {
  name?: string;
  descriptor?: BoardDescriptor;
  /** The unit documents the session links against, keyed by `uri`: a composed
   *  demo's, or those a session resumed from history was stored with. */
  units?: Record<string, BoardDescriptor>;
  /** Set when the session was opened to run a cloud board: the playground
   *  boots into its Cloud tab with that board hydrated. */
  cloudBoard?: OpenCloudBoardSignal;
  /** The saved board or demo the session is, which the board menu offers to
   *  pin. Unset on a board that is neither (new, from source, a cloud board). */
  pinnable?: PinTarget;
  /** Set, to when, by a launch from a pin that opens as an app: the board is
   *  shown in app mode once it has loaded. A new time asks again. */
  openAsApp?: number;
};

function savedSession(name: string): BoardSession {
  return { name, pinnable: { action: { kind: "saved", name }, title: name } };
}

/** A demo, opened from the start page or launched from the Home Screen. */
function demoSession(slug: string): BoardSession | null {
  const board = findDemoBoard(slug);
  if (!board) {
    return null;
  }
  const name = board.boardName ?? slug;
  return {
    name,
    descriptor: board,
    units: findDemoUnits(slug),
    pinnable: {
      action: { kind: "demo", slug },
      // What the start page calls it, and so what it pins it as.
      title: DEMO_CATALOG.find((entry) => entry.slug === slug)?.label ?? name,
    },
  };
}

/** The demo a session of that name was, which is named after the demo's board
 *  (`demoSession`): what the board to continue is when nothing is saved under
 *  its name. Null for a name two demos share: guessing would pin the other. */
function demoSessionNamed(name: string): BoardSession | null {
  const named = DEMO_CATALOG.filter(
    ({ slug }) => (findDemoBoard(slug)?.boardName ?? slug) === name,
  );
  return named.length === 1 ? demoSession(named[0].slug) : null;
}

function StartScreen({
  onOpenSession,
  onShowAccount,
  onOpenSettings,
  remotes,
  pins,
  onBoardDeleted,
  recentBoardName,
}: {
  onOpenSession: (session: BoardSession) => void;
  onShowAccount: () => void;
  onOpenSettings: (section?: string) => void;
  remotes: RemotesController;
  pins: PinsController;
  /** A deleted board may have been the one to continue: the host reads that
   *  again. */
  onBoardDeleted: (name: string) => void;
  /** The board last worked on, offered to continue. */
  recentBoardName: string | null;
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

  const listSavedBoards = useCallback(async () => {
    await whenLibraryReady();
    return (await getBackend()).fetchSavedBoardEntries();
  }, []);

  const describeBoard = useCallback(async (name: string) => {
    try {
      return (await (await getBackend()).loadBoard(name)).description;
    } catch {
      return undefined;
    }
  }, []);

  const deleteBoard = useCallback(
    async (name: string) => {
      await deleteSavedBoard(name);
      onBoardDeleted(name);
    },
    [onBoardDeleted],
  );

  const listBoardHistory = useCallback(
    async (name: string): Promise<BoardHistoryItem[]> => {
      const entries = await (await getBackend()).loadBoardHistory(name);
      return entries.map((entry) => ({
        timestamp: entry.timestamp,
        label: entry.label,
        open: () => {
          const { board, units } = resumedFrom(entry);
          onOpenSession({ ...savedSession(name), descriptor: board, units });
        },
      }));
    },
    [onOpenSession],
  );

  const continueRecent = async () => {
    if (!recentBoardName) {
      return;
    }
    const [resumed, saved] = await Promise.all([
      resumeBoard(recentBoardName),
      savedBoardNames().catch(() => [] as string[]),
    ]);
    if (resumed) {
      // The board to continue is the one last worked on, saved or not: a demo
      // keeps a history under its name too, and is pinned as that demo.
      const opened = saved.includes(recentBoardName)
        ? savedSession(recentBoardName)
        : (demoSessionNamed(recentBoardName) ?? { name: recentBoardName });
      onOpenSession({
        ...opened,
        descriptor: resumed.board,
        units: resumed.units,
      });
    } else {
      toast.error(`“${recentBoardName}” is no longer on this device`);
    }
  };

  const boardStates = useMemo<Record<string, BoardState>>(
    () => (recentBoardName ? { [recentBoardName]: "recent" } : {}),
    [recentBoardName],
  );

  const handleCreateNamedBoard = async (name: string) => {
    try {
      // Persist right away so the folder reference resolves on return.
      await (await getBackend()).saveBoard(name, createEmptyBoard(name));
    } catch {
      // Opening still works; the board just isn't saved yet.
      onOpenSession({ name });
      return;
    }
    onOpenSession(savedSession(name));
  };

  const handleOpen = (action: BoardAction) => {
    switch (action.kind) {
      case "saved":
        onOpenSession(savedSession(action.name));
        break;
      case "demo": {
        const demo = demoSession(action.slug);
        if (demo) {
          onOpenSession(demo);
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
      onCreateNamedBoard={(name) => void handleCreateNamedBoard(name)}
      recentBoardName={recentBoardName}
      onContinueRecent={() => void continueRecent()}
      boardStates={boardStates}
      describeBoard={describeBoard}
      listBoardHistory={listBoardHistory}
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
      onOpenSettings={onOpenSettings}
    />
  );
}

export default function MobileApp() {
  const [session, setSession] = useState<BoardSession | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  // Open, and at which section when something asked for one.
  const [showSettings, setShowSettings] = useState<{ section?: string } | null>(
    null,
  );
  const remotes = useBackendRemotes();
  const { pins, pinnedTitle, dismissPinned } = usePins();
  // Read again each time the start page shows: working on a board makes it
  // the one to continue.
  const [recentBoardName, setRecentBoardName] = useState<string | null>(null);
  useEffect(() => {
    if (session === null) {
      setRecentBoardName(lastBoardName());
    }
  }, [session]);

  const sessionNameRef = useRef<string | undefined>(undefined);
  sessionNameRef.current = session?.name;
  const onBoardSnapshot = useCallback(
    (snapshot: BoardSnapshot) => recordSnapshot(snapshot, sessionNameRef.current),
    [],
  );
  const onSaveBoard = useCallback(
    (name: string, payload: BoardDescriptor) => {
      void getBackend()
        .then((backend) => backend.saveBoard(name, payload))
        .then(() => toast.success(`Saved “${name}”`))
        .catch((err: unknown) =>
          toast.error(`Could not save “${name}”`, {
            description: err instanceof Error ? err.message : undefined,
          }),
        );
    },
    [],
  );

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
    setShowSettings(null);
    // A pin whose board has gone has no details to unpin it from: offered
    // here, where it turns up.
    const unpinAction = {
      label: "Unpin",
      onClick: () =>
        void removePin(target).catch((err: unknown) =>
          toast.error("Could not unpin it", {
            description: err instanceof Error ? err.message : undefined,
          }),
        ),
    };
    let next: BoardSession | null = null;
    if (target.kind === "saved") {
      const names = await savedBoardNames().catch(() => [] as string[]);
      if (names.includes(target.id)) {
        next = savedSession(target.id);
      } else {
        toast.error(`“${target.id}” is no longer on this device`, {
          description: "It was deleted or renamed, so its pin opens nothing.",
          action: unpinAction,
        });
      }
    } else {
      next = demoSession(target.id);
      if (!next) {
        toast.error("This demo is not part of this version of Readymade", {
          action: unpinAction,
        });
      }
    }
    if (!next) {
      setSession(null);
      return;
    }
    const opening: BoardSession = opensAsApp(target)
      ? { ...next, openAsApp: Date.now() }
      : next;
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
      // Kept open, and still asked to be shown as an app.
      if (launchSession.openAsApp) {
        setSession({ ...session, openAsApp: launchSession.openAsApp });
      }
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

  // Deleting unpins the board itself (library/deleteBoard); what is left to
  // the host is not offering it to continue.
  const handleBoardDeleted = useCallback(() => {
    setRecentBoardName(lastBoardName());
  }, []);

  // Share feature: a share captured by the iOS share extension is delivered by
  // the native bridge, previewed in a picker, then injected into the board the
  // user chooses. `pendingShare` awaits a board choice; `shareToInject` is the
  // chosen-but-not-yet-consumed share the BoardShareConsumer runs once ready.
  const [pendingShare, setPendingShare] = useState<SharePayload | null>(null);
  const [shareToInject, setShareToInject] = useState<SharePayload | null>(null);
  // True while a share is in flight (picking or injecting), so newly delivered
  // shares queue on window.__READYMADE_SHARES__ instead of clobbering the UI.
  const shareActiveRef = useRef(false);

  // The library's board names, read when a share needs a board.
  const [shareBoardNames, setShareBoardNames] = useState<string[]>([]);

  const promoteNextShare = useCallback(async () => {
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
    const boards = await savedBoardNames().catch(() => [] as string[]);
    setShareBoardNames(boards);
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
      setSession(savedSession(shareToInject.boardName));
    }
  }, [shareToInject, session]);

  useEffect(() => {
    // Native pushes each envelope onto the queue and then calls this; also
    // drain anything queued before mount (cold launch from the share sheet).
    const onShare = () => void promoteNextShare();
    window.__readymadeOnShare = onShare;
    onShare();
    return () => {
      if (window.__readymadeOnShare === onShare) {
        delete window.__readymadeOnShare;
      }
    };
  }, [promoteNextShare]);

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
    void promoteNextShare();
  }, [promoteNextShare]);

  const handleShareConsumed = useCallback(() => {
    setShareToInject(null);
    shareActiveRef.current = false;
    void promoteNextShare();
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
            onOpenSettings={() => setShowSettings({})}
            remotes={remotes}
            pins={pins}
            onBoardDeleted={handleBoardDeleted}
            recentBoardName={recentBoardName}
          />
        ) : (
          <MobilePlaygroundWithRouter
            boardName={session.name}
            boardDescriptor={session.descriptor}
            unitDocuments={session.units}
            openCloudBoard={session.cloudBoard}
            pins={pins}
            pinnable={session.pinnable}
            openAsApp={session.openAsApp}
            onBoardSnapshot={onBoardSnapshot}
            onSaveBoard={onSaveBoard}
            onChangeBoardname={(name: string) =>
              setSession((prev) => ({ ...prev, name }))
            }
            onNewBoard={() => setSession({})}
            onHome={() => setSession(null)}
            onOpenSettings={(section) => setShowSettings({ section })}
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
        {/* Over the board too, for the same reason as the account. */}
        {showSettings && (
          <MobileSettings
            initialSection={showSettings.section}
            onClose={() => setShowSettings(null)}
            remotes={remotes}
          />
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
            boards={shareBoardNames}
            onPick={handlePickShareBoard}
            onCancel={handleCancelShare}
          />
        )}
      </HkpApp>
    </MeanderPlatformProvider>
  );
}
