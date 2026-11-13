import { useEffect, useMemo, useState } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { OverviewLayout, OverviewScene, buildScene } from "./graph";
import { ServicesByRuntime, readBoardShape } from "./shape";

/**
 * The board as a scene — every service at every nesting depth, with its
 * ancestry and labels — for as long as `enabled` holds.
 *
 * The descriptors draw the board straight away; what the services report
 * replaces them a moment later, and is what carries the nesting (see
 * `shape.ts`). `settled` says the reported shape has arrived, so a caller
 * looking for a nested service can tell "not there" from "not read yet".
 *
 * Shared by the overview, which draws it, and the facade's bindings, which
 * name where a widget's services live. A pipeline configured in this session
 * changes the answer without changing the board's services, so a caller that
 * reads it on demand rather than continuously bumps `generation` to read again.
 */
export function useBoardScene(
  boardContext: BoardContextState | null | undefined,
  enabled: boolean,
  layout: OverviewLayout = "lanes",
  generation = 0,
): { scene: OverviewScene | null; settled: boolean } {
  // What the services report about themselves, which is where a pipeline built
  // in this session is. Read when enabled, and again whenever the board gains
  // or loses a service — the two moments the answer can have changed.
  const [reported, setReported] = useState<ServicesByRuntime | null>(null);
  useEffect(() => {
    if (!enabled || !boardContext) {
      setReported(null);
      return;
    }
    // A read again keeps showing the last answer until the new one arrives.
    let current = true;
    readBoardShape({
      runtimes: boardContext.runtimes,
      services: boardContext.services,
      scopes: boardContext.scopes,
      runtimeApis: boardContext.runtimeApis,
    })
      .then((shape) => {
        if (current) {
          setReported(shape);
        }
      })
      .catch(() => {
        // Nothing to show for it: the descriptors below still draw a board.
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, boardContext?.runtimes, boardContext?.services, generation]);

  const scene = useMemo(() => {
    if (!boardContext) {
      return null;
    }
    return buildScene(
      boardContext.runtimes,
      reported ?? boardContext.services,
      layout,
    );
    // The scene is rebuilt whenever the board's shape changes. Configuration
    // that leaves the shape alone does not touch these slices, and depending on
    // the whole context instead would rebuild it on every board render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardContext?.runtimes, boardContext?.services, reported, layout]);

  return { scene, settled: reported !== null };
}
