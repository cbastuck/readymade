/**
 * Which half of a facade board is on screen, and whether the facade editor is
 * open beside it.
 *
 * The controls for this used to sit in a bar the facade drew for itself, which
 * put a second menu bar under the first and repeated the board name in both.
 * They belong in the toolbar, but the toolbar is mounted above the board view
 * rather than inside it, so the state the two now share lives here — the same
 * arrangement the overview uses, and for the same reason: neither side has to
 * know where the other is, and a host that mounts no provider gets a control
 * that renders nothing.
 *
 * The facade and the board were two independent switches, which offered four
 * combinations for three reachable states — hiding both leaves an empty view,
 * so hiding one had to reveal the other. As one mode the invariant is
 * structural rather than enforced, and the choice reads as the choice it is.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { BoardContextState } from "../BoardContext";

/** Facade alone, both halves, or the board's runtimes alone. */
export type FacadeViewMode = "facade" | "split" | "board";

export type FacadeViewApi = {
  mode: FacadeViewMode;
  setMode: (mode: FacadeViewMode) => void;
  /** `mode` as the two flags the layout is expressed in. */
  showFacade: boolean;
  showRuntime: boolean;
  editorOpen: boolean;
  toggleEditor: () => void;
};

const FacadeViewCtx = createContext<FacadeViewApi | null>(null);

export function useFacadeView(): FacadeViewApi | null {
  return useContext(FacadeViewCtx);
}

const facadeKey = (boardName: string) => `hkp-facade-visible-${boardName}`;
const runtimeKey = (boardName: string) => `hkp-facade-runtime-${boardName}`;

/**
 * The stored layout, in the two flags it has always been stored as, so a board
 * left in a layout before this control existed opens in it still. A pair that
 * says neither half is shown resolves to the board rather than to nothing.
 */
function readMode(boardName: string): FacadeViewMode {
  if (localStorage.getItem(facadeKey(boardName)) === "false") {
    return "board";
  }
  return localStorage.getItem(runtimeKey(boardName)) === "true"
    ? "split"
    : "facade";
}

/**
 * Whether there is a board yet.
 *
 * A board with no runtimes is not shown as a board at all — the playground
 * offers a place to start one instead — so there is nothing for these controls
 * to act on and nowhere for a facade to sit.
 */
export function boardHasRuntimes(
  boardContext: BoardContextState | null | undefined,
): boolean {
  return (boardContext?.runtimes.length ?? 0) > 0;
}

/**
 * Whether there is a facade to switch away from.
 *
 * A composition contributes a view per unit and an ordinary board has the one
 * facade it declares; either way an empty board has nothing to look at yet.
 */
export function boardHasFacade(
  boardContext: BoardContextState | null | undefined,
): boolean {
  if (!boardHasRuntimes(boardContext)) {
    return false;
  }
  return (
    (boardContext!.linkage?.views.length ?? 0) > 0 || !!boardContext!.facade
  );
}

export function FacadeViewProvider({
  boardName,
  children,
}: {
  boardName: string;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<FacadeViewMode>(() =>
    readMode(boardName),
  );

  // The board is fetched after the shell is up, so the name this is stored
  // under is not known at mount — and changes again whenever another board is
  // opened without the view being torn down.
  useEffect(() => {
    setModeState(readMode(boardName));
  }, [boardName]);

  const setMode = useCallback(
    (next: FacadeViewMode) => {
      setModeState(next);
      localStorage.setItem(facadeKey(boardName), String(next !== "board"));
      localStorage.setItem(runtimeKey(boardName), String(next !== "facade"));
    },
    [boardName],
  );

  // Not remembered: the editor is opened to make a change and closed again,
  // and a board that opens with it already up hides half of what it is.
  const [editorOpen, setEditorOpen] = useState(false);
  const toggleEditor = useCallback(() => setEditorOpen((open) => !open), []);

  const api = useMemo<FacadeViewApi>(
    () => ({
      mode,
      setMode,
      showFacade: mode !== "board",
      showRuntime: mode !== "facade",
      editorOpen,
      toggleEditor,
    }),
    [mode, setMode, editorOpen, toggleEditor],
  );

  return (
    <FacadeViewCtx.Provider value={api}>{children}</FacadeViewCtx.Provider>
  );
}
