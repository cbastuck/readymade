import { useCallback, useEffect, useRef, useState } from "react";

import { BoardContextState } from "../../../BoardContext";
import { FacadeStateContext } from "../../../facade/FacadeStateContext";
import { executeActions } from "../../../facade/executeActions";
import { PanelRenderer } from "../../../facade/panels/PanelRenderer";
import { FacadeDescriptor } from "../../../facade/types";

/**
 * Touch-friendly facade renderer for the mobile board view. Mirrors the core of
 * the desktop `FacadeRenderer` (facade state store, `facade.init`, panel
 * rendering) without its mouse-driven splitters / side-by-side editor. Panels
 * stack vertically and scroll.
 */
export default function MobileFacadeView({
  facade,
  boardContext,
  boardName,
}: {
  facade: FacadeDescriptor;
  boardContext: BoardContextState;
  boardName: string;
}) {
  const [facadeState, setFacadeStateRaw] = useState<Record<string, unknown>>(
    () => facade.state ?? {},
  );

  useEffect(() => {
    setFacadeStateRaw(facade.state ?? {});
  }, [boardName]);

  const setFacadeStateEntry = useCallback((key: string, value: unknown) => {
    setFacadeStateRaw((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Keep a ref so the init effect always sees the latest state at fire time.
  const facadeStateRef = useRef(facadeState);
  facadeStateRef.current = facadeState;

  useEffect(() => {
    if (!facade.init?.length) {
      return;
    }
    executeActions({
      actions: facade.init,
      value: undefined,
      boardContext,
      setState: setFacadeStateEntry,
      state: facadeStateRef.current,
    });
  }, [boardName]); // eslint-disable-line react-hooks/exhaustive-deps

  const multiPanel = facade.panels.length > 1;

  return (
    <FacadeStateContext.Provider
      value={{ state: facadeState, setState: setFacadeStateEntry }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
          background: "hsl(var(--background))",
          fontFamily: "'Recursive', monospace",
        }}
      >
        {facade.panels.map((panel) => (
          <div
            key={panel.id}
            style={{
              display: "flex",
              flexDirection: "column",
              borderBottom: multiPanel ? "1px solid hsl(var(--border))" : undefined,
            }}
          >
            <PanelRenderer
              panel={panel}
              boardContext={boardContext}
              showTitle={multiPanel}
            />
          </div>
        ))}
      </div>
    </FacadeStateContext.Provider>
  );
}
