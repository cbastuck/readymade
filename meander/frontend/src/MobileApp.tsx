import { useEffect, useMemo, useState } from "react";
import HkpApp from "hkp-frontend/src/App";
import MobilePlaygroundWithRouter from "hkp-frontend/src/views/playground/mobile/index";
import { MeanderPlatformProvider } from "./platform/MeanderPlatformProvider";
import { Remote } from "./types";
import { getRemotes } from "./actions";

export default function MobileApp() {
  const [boardName, setBoardName] = useState<string | undefined>(undefined);
  const [remotes, setRemotes] = useState<Remote[] | null>(null);

  useEffect(() => {
    getRemotes().then(setRemotes);
  }, []);

  const availableRuntimeEngines = useMemo(
    () => [
      { type: "browser", name: "Browser Runtime" },
      ...(remotes ?? []).map((r) => ({
        type: "rest" as const,
        name: r.name,
        url: r.url,
      })),
    ],
    [remotes],
  );

  return (
    <MeanderPlatformProvider>
      <HkpApp defaultThemeName="playground">
        <MobilePlaygroundWithRouter
          boardName={boardName}
          onChangeBoardname={setBoardName}
          onNewBoard={() => setBoardName(undefined)}
          availableRuntimeEngines={availableRuntimeEngines}
        />
      </HkpApp>
    </MeanderPlatformProvider>
  );
}
