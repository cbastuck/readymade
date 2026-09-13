/**
 * Which runtime on the board canvas is being worked on.
 *
 * The canvas and the palette are siblings under the playground — neither is
 * mounted inside the other — so what one has selected reaches the other from
 * here, the same arrangement the overview and the facade view use. A host that
 * mounts no provider gets a hook that returns null, and everything reading it
 * behaves as it did before: nothing is selected, nothing reacts to it.
 *
 * This is view state, not board state: it is never written to the board
 * document and does not outlive the session. It says where the next thing a
 * person does is aimed — which services the palette brings into view, and
 * which runtime a keystroke would act on.
 *
 * A selection stays until another runtime takes it. Clearing it on a click
 * beside the board would cost the palette its position at the moment someone
 * reaches past it, which is the opposite of what the selection is for.
 */
import { createContext, useContext, useMemo, useState } from "react";

export type SelectionApi = {
  /** The selected runtime's id, or null when nothing is selected. */
  selectedRuntimeId: string | null;
  /** Select a runtime, or pass null to select nothing. */
  selectRuntime: (runtimeId: string | null) => void;
};

const SelectionCtx = createContext<SelectionApi | null>(null);

export function useSelection(): SelectionApi | null {
  return useContext(SelectionCtx);
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(
    null,
  );

  const api = useMemo<SelectionApi>(
    () => ({ selectedRuntimeId, selectRuntime: setSelectedRuntimeId }),
    [selectedRuntimeId],
  );

  return <SelectionCtx.Provider value={api}>{children}</SelectionCtx.Provider>;
}

export default SelectionCtx;
