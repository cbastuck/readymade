import HkpApp from "hkp-frontend/src/App";
import MeanderPlayground from "./MeanderPlayground";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import { useEffect, useState } from "react";
import { useLocation } from "hkp-frontend/src/router";
import { BoardDescriptor } from "hkp-frontend/src/types";
import CloudBoards from "hkp-frontend/src/views/cloud";
import StartPage from "./StartPage";
import { getBackend } from "./backend";
import LoadIndicator from "./LoadIndicator";
import { VaultProvider } from "hkp-frontend/src/VaultContext";
import { DEMO_BOARDS } from "./demoBoards";

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

function App() {
  return (
    <VaultProvider>
      <MeanderPlatformProvider>
        <HkpApp defaultThemeName="playground">
          <MeanderShell />
        </HkpApp>
      </MeanderPlatformProvider>
    </VaultProvider>
  );
}

/**
 * Lives inside HkpApp's Router so it can react to the route. The toolbar's cloud
 * button navigates to /cloud-boards; we render the shared (login-gated) cloud
 * view for that route and the local playground/start otherwise.
 */
function MeanderShell() {
  const location = useLocation();
  const [view, setView] = useState<View>(() =>
    shouldRenderPlaygroundFromUrl() ? { type: "loading" } : { type: "start" },
  );

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

  const onShowStartPage = () => {
    setView({ type: "start" });
    window.history.replaceState(null, "", "/");
  };

  const onRestoreBoard = (board: BoardDescriptor | null | undefined) => {
    setView({ type: "playground", board: board ?? null });
    window.history.replaceState(null, "", "/playground");
  };

  if (location.pathname.startsWith("/cloud-boards")) {
    return <CloudBoards />;
  }

  if (view.type === "loading") {
    return <LoadIndicator />;
  }
  if (view.type === "playground") {
    return (
      <MeanderPlayground initialBoard={view.board} onLogo={onShowStartPage} />
    );
  }
  return <StartPage onRestoreBoard={onRestoreBoard} />;
}

export default App;
