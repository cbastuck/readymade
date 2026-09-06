import HkpApp from "hkp-frontend/src/App";
// The app signs users in through Auth0's Native application (the RFC 8252 flow
// in meanderLogin), so that is the one the Auth0 client here is configured for.
import { AUTH0_CLIENT_ID } from "./auth/meanderLogin";
import MeanderPlayground from "./MeanderPlayground";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "hkp-frontend/src/router";
import { BoardDescriptor } from "hkp-frontend/src/types";
import CloudBoards from "hkp-frontend/src/views/cloud";
import Remotes from "hkp-frontend/src/views/remotes";
import { useBackendRemotes } from "./useBackendRemotes";
import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";
import StartPage from "./StartPage";
import { getBackend } from "./backend";
import LoadIndicator from "./LoadIndicator";
import { VaultProvider } from "hkp-frontend/src/VaultContext";
import { DEMO_BOARDS } from "./demoBoards";
import { useShareFlow } from "./share/useShareFlow";
import ShareOverlay from "./share/ShareOverlay";
import SecretConsentDialog from "./SecretConsentDialog";

function demoSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findDemoBySlug(slug: string): BoardDescriptor | undefined {
  const match = DEMO_BOARDS.find(
    (e) => e.slug === slug || demoSlug(e.label) === slug,
  );
  return match?.board as BoardDescriptor | undefined;
}

function shouldRenderPlaygroundFromUrl() {
  const { pathname } = window.location;
  return pathname === "/playground" || pathname.startsWith("/playground/");
}

async function tryResumeLastBoard(): Promise<BoardDescriptor | undefined> {
  const lastBoardName = localStorage.getItem("lastActiveBoardName");
  if (!lastBoardName) return undefined;
  const backend = await getBackend();
  try {
    const history = await backend.loadBoardHistory(lastBoardName);
    if (history.length > 0) return history[0].snapshot;
  } catch {}
  try {
    return await backend.loadBoard(lastBoardName);
  } catch {}
  return undefined;
}

type View =
  | { type: "start" }
  | { type: "loading" }
  | { type: "playground"; board: BoardDescriptor | null };

/** Top-left logo for the cloud view, matching the playground's. */
function CloudLogo({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Start"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: "4px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      <IconH
        className="stroke-[#333] hover:stroke-sky-600"
        width={24}
        height={24}
      />
    </button>
  );
}

/**
 * The start page's Remotes source opens a runtime here:
 * /remotes/<server>/<runtimeId>. Read-only — the runtime belongs to whoever
 * created it, which the server does not record.
 */
function RemoteRuntimeView({
  path,
  logoSlot,
}: {
  path: string;
  logoSlot: ReactNode;
}) {
  const remotes = useBackendRemotes();
  const [remoteName, runtimeId] = path
    .replace(/^\/remotes\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  return (
    <Remotes
      remotes={remotes.runtimes}
      remoteName={remoteName}
      runtimeId={runtimeId}
      logoSlot={logoSlot}
    />
  );
}

function App() {
  return (
    <VaultProvider>
      <MeanderPlatformProvider>
        <HkpApp defaultThemeName="playground" clientId={AUTH0_CLIENT_ID}>
          <MeanderShell />
          {/* Outside the shell: a board is provisioned while a view is being
              set up, and the question has to survive whatever is mounting. */}
          <SecretConsentDialog />
        </HkpApp>
      </MeanderPlatformProvider>
    </VaultProvider>
  );
}

/**
 * Lives inside HkpApp's Router so it can react to the route. The start page's
 * Cloud Boards source navigates to /cloud-boards; we render the shared
 * (login-gated) cloud view for that route and the local playground/start
 * otherwise.
 */
function MeanderShell() {
  const location = useLocation();
  // Which shell view is showing is decided by the route below, so leaving one
  // has to go through the router. history.replaceState changes the URL without
  // telling it, which leaves the cloud view rendering over a start page that
  // thinks it is showing.
  const navigate = useNavigate();
  const [view, setView] = useState<View>(() =>
    shouldRenderPlaygroundFromUrl() ? { type: "loading" } : { type: "start" },
  );
  // Bumped when a share opens a board while the playground is already mounted:
  // the playground only honors its board descriptor on the initial fetch, so a
  // fresh key forces a remount with the picked board.
  const [playgroundKey, setPlaygroundKey] = useState(0);

  // Share feature (see MobileApp.tsx for the iOS counterpart): the state
  // machine lives in useShareFlow; this component only supplies how to open
  // the picked board and where to render the overlay/consumer.
  const openBoardForShare = useCallback(async (name: string) => {
    const backend = await getBackend();
    const board = await backend.loadBoard(name);
    setPlaygroundKey((key) => key + 1);
    setView({ type: "playground", board });
    navigate("/playground", { replace: true });
  }, [navigate]);
  const share = useShareFlow(openBoardForShare);

  const onShowStartPage = () => {
    setView({ type: "start" });
    navigate("/", { replace: true });
  };

  const onRestoreBoard = (board: BoardDescriptor | null | undefined) => {
    setView({ type: "playground", board: board ?? null });
    navigate("/playground", { replace: true });
  };

  useEffect(() => {
    if (view.type !== "loading") return;
    const demoParam = new URLSearchParams(window.location.search).get("demo");
    if (demoParam) {
      const board = findDemoBySlug(demoParam);
      if (board) {
        setView({ type: "playground", board });
        return;
      }
    }
    tryResumeLastBoard().then((board) =>
      setView({ type: "playground", board: board ?? null }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  let content;
  if (location.pathname.startsWith("/cloud-boards")) {
    // Same logo affordance as the playground: without a slot the Toolbar
    // renders a mark that looks clickable but goes nowhere.
    content = <CloudBoards logoSlot={<CloudLogo onClick={onShowStartPage} />} />;
  } else if (location.pathname.startsWith("/remotes")) {
    content = (
      <RemoteRuntimeView
        path={location.pathname}
        logoSlot={<CloudLogo onClick={onShowStartPage} />}
      />
    );
  } else if (view.type === "loading") {
    content = <LoadIndicator />;
  } else if (view.type === "playground") {
    content = (
      <MeanderPlayground
        key={playgroundKey}
        initialBoard={view.board}
        onLogo={onShowStartPage}
        shareToInject={share.shareToInject}
        onShareConsumed={share.onShareConsumed}
      />
    );
  } else {
    content = <StartPage onRestoreBoard={onRestoreBoard} />;
  }

  return (
    <>
      {content}
      <ShareOverlay flow={share} />
    </>
  );
}

export default App;
