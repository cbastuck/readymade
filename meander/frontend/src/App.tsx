import HkpApp from "hkp-frontend/src/App";
import MeanderPlayground from "./MeanderPlayground";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import { useEffect, useState } from "react";
import { BoardDescriptor } from "hkp-frontend/src/types";
import StartPage from "./StartPage";
import { getBackend } from "./backend";
import LoadIndicator from "./LoadIndicator";

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
  const [view, setView] = useState<View>(() =>
    shouldRenderPlaygroundFromUrl() ? { type: "loading" } : { type: "start" },
  );

  useEffect(() => {
    if (view.type !== "loading") return;
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

  return (
    <MeanderPlatformProvider>
      <HkpApp defaultThemeName="playground">
        {view.type === "loading" ? (
          <LoadIndicator />
        ) : view.type === "playground" ? (
          <MeanderPlayground
            initialBoard={view.board}
            onLogo={onShowStartPage}
          />
        ) : (
          <StartPage onRestoreBoard={onRestoreBoard} />
        )}
      </HkpApp>
    </MeanderPlatformProvider>
  );
}

export default App;
