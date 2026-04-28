import HkpApp from "hkp-frontend/src/App";
import MeanderPlayground from "./MeanderPlayground";
import { useState } from "react";
import { BoardDescriptor } from "hkp-frontend/src/types";
import StartPage from "./StartPage";

function shouldRenderPlaygroundFromUrl() {
  const { pathname } = window.location;
  return pathname === "/playground" || pathname.startsWith("/playground/");
}

function App() {
  const [boardDescriptor, setBoardDescriptor] = useState<
    BoardDescriptor | null | undefined
  >(() => (shouldRenderPlaygroundFromUrl() ? undefined : null)); // undefined means empty playground

  const onShowStartPage = () => {
    setBoardDescriptor(null);
  };
  return (
    <HkpApp>
      {boardDescriptor !== null ? (
        <MeanderPlayground
          initialBoard={boardDescriptor}
          onLogo={onShowStartPage}
        />
      ) : (
        <StartPage onRestoreBoard={setBoardDescriptor} />
      )}
    </HkpApp>
  );
}

export default App;
