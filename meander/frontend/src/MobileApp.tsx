import { useCallback, useMemo, useState } from "react";
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
          />
        )}
      </HkpApp>
    </MeanderPlatformProvider>
  );
}
