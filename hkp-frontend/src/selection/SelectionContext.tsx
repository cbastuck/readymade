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
 * A selection stays until another runtime takes it, or until a click on the
 * board canvas's own background, or on the selected runtime's own background
 * once nothing in it is picked, lets it go. Only there: clearing it on a click
 * beside the board would cost the palette its position at the moment someone
 * reaches past it, which is the opposite of what the selection is for. Short
 * of that, a board holding runtimes has one of them selected: the provider is
 * told which runtimes the board holds and falls back to the first of them
 * whenever what a person picked is not among them — before anyone has picked
 * at all, and after the runtime they picked was removed. Letting go is a pick
 * of its own and is not fallen back from: nothing is selected until a runtime
 * is touched again.
 *
 * The fallback is derived rather than stored, so a pick outlives its runtime
 * leaving and coming back: reimporting the same board puts the selection back
 * where the person left it.
 *
 * Within the selected runtime, services can be picked too: a run of them,
 * which is what an action on several services at once — wrapping them in a
 * sub-service, making a block of them — acts on. Unlike the runtime it can be
 * empty, and it is emptied by Escape, by clicking a picked card again, by
 * clicking the runtime's background, by an action that used it, and by
 * another runtime being selected. Clicking a card
 * picks it as the anchor; Shift-clicking another service header stretches the
 * run from there.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/** Services picked in one runtime, and the one the pick started from. */
export type ServiceSelection = {
  runtimeId: string;
  anchor: string;
  uuids: string[];
};

export type SelectionApi = {
  /** The selected runtime's id, or null when there is none or it was let go. */
  selectedRuntimeId: string | null;
  /** Select a runtime; null selects none. */
  selectRuntime: (runtimeId: string | null) => void;
  /** The services picked, or null when none are. */
  selectedServices?: ServiceSelection | null;
  /** Pick these services, replacing what was picked; null picks none. */
  selectServices?: (selection: ServiceSelection | null) => void;
};

const SelectionCtx = createContext<SelectionApi | null>(null);

/**
 * Whether the service whose frame this is drawn in is picked. Set by the list
 * a runtime draws its own services in, and cleared again for what a panel
 * draws inside itself, so a nested service is never shown as picked.
 */
export const ServicePickedContext = createContext(false);

export function useServicePicked(): boolean {
  return useContext(ServicePickedContext);
}

export function useSelection(): SelectionApi | null {
  return useContext(SelectionCtx);
}

/**
 * Whether a click landed on the background of the element handling it — the
 * gesture that lets a selection go. Not inside `ownPicks`, whose clicks make
 * picks of their own; not on a control, which keeps its meaning; and not from
 * a portal (a menu, a popover), whose clicks bubble through React to an
 * element they never landed on.
 */
export function isBackgroundClick(
  ev: React.MouseEvent<HTMLElement>,
  ownPicks: string,
): boolean {
  const target = ev.target as HTMLElement;
  return (
    !ev.defaultPrevented &&
    ev.currentTarget.contains(target) &&
    !target.closest(
      `${ownPicks}, input, textarea, select, button, a, [contenteditable='true'], [role='button'], [role='menuitem']`,
    )
  );
}

export function SelectionProvider({
  runtimeIds,
  children,
}: {
  /** The board's runtimes, in board order — the first one is the fallback. */
  runtimeIds: readonly string[];
  children: React.ReactNode;
}) {
  // Undefined until someone picks; null once they let go.
  const [pickedRuntimeId, setPickedRuntimeId] = useState<
    string | null | undefined
  >(undefined);
  const [pickedServices, setPickedServices] = useState<ServiceSelection | null>(
    null,
  );

  const selectedRuntimeId =
    pickedRuntimeId === null
      ? null
      : pickedRuntimeId !== undefined && runtimeIds.includes(pickedRuntimeId)
        ? pickedRuntimeId
        : (runtimeIds[0] ?? null);
  const selectedServices =
    pickedServices && pickedServices.runtimeId === selectedRuntimeId
      ? pickedServices
      : null;

  useEffect(() => {
    if (!selectedServices) {
      return;
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setPickedServices(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedServices]);

  const api = useMemo<SelectionApi>(
    () => ({
      selectedRuntimeId,
      selectRuntime: (runtimeId: string | null) => {
        setPickedRuntimeId(runtimeId);
        setPickedServices((prev) =>
          prev && prev.runtimeId !== runtimeId ? null : prev,
        );
      },
      selectedServices,
      selectServices: setPickedServices,
    }),
    [selectedRuntimeId, selectedServices],
  );

  return <SelectionCtx.Provider value={api}>{children}</SelectionCtx.Provider>;
}

export default SelectionCtx;
