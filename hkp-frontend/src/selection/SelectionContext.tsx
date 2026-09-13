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
 * reaches past it, which is the opposite of what the selection is for. There
 * is therefore no gesture that selects nothing, and a board holding runtimes
 * always has one of them selected: the provider is told which runtimes the
 * board holds and falls back to the first of them whenever what a person
 * picked is not among them — before anyone has picked at all, and after the
 * runtime they picked was removed. Nothing selected means no runtime exists.
 *
 * The fallback is derived rather than stored, so a pick outlives its runtime
 * leaving and coming back: reimporting the same board puts the selection back
 * where the person left it.
 */
import { createContext, useContext, useMemo, useState } from "react";

export type SelectionApi = {
  /** The selected runtime's id, or null when the board has no runtimes. */
  selectedRuntimeId: string | null;
  /** Select a runtime. */
  selectRuntime: (runtimeId: string) => void;
};

const SelectionCtx = createContext<SelectionApi | null>(null);

export function useSelection(): SelectionApi | null {
  return useContext(SelectionCtx);
}

export function SelectionProvider({
  runtimeIds,
  children,
}: {
  /** The board's runtimes, in board order — the first one is the fallback. */
  runtimeIds: readonly string[];
  children: React.ReactNode;
}) {
  const [pickedRuntimeId, setPickedRuntimeId] = useState<string | null>(null);

  const selectedRuntimeId =
    pickedRuntimeId !== null && runtimeIds.includes(pickedRuntimeId)
      ? pickedRuntimeId
      : (runtimeIds[0] ?? null);

  const api = useMemo<SelectionApi>(
    () => ({ selectedRuntimeId, selectRuntime: setPickedRuntimeId }),
    [selectedRuntimeId],
  );

  return <SelectionCtx.Provider value={api}>{children}</SelectionCtx.Provider>;
}

export default SelectionCtx;
