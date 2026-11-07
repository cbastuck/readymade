import { getBackend } from "../backend";
import { listPins, removePin, samePin } from "../homeScreen/homeScreen";
import { forgetLastBoard } from "./boardHistory";

/**
 * Deletes a saved board, and what the app keeps about it beside the library:
 * its history, its Home Screen pin and its being the board to continue.
 *
 * Every view that deletes a board deletes it through this — the start page
 * directly, the playground's Hub through the platform's `deleteSavedBoard` —
 * so none of them leaves Continue offering a board that is gone, or a pin
 * that leads to "no longer on this device".
 */
export async function deleteSavedBoard(name: string): Promise<void> {
  const backend = await getBackend();
  await backend.deleteBoard(name);
  forgetLastBoard(name);
  // The board is gone either way; what is left over only clutters.
  await backend.clearBoardHistory(name).catch(() => {});
  const pin = { kind: "saved", id: name } as const;
  try {
    if ((await listPins()).some((pinned) => samePin(pinned, pin))) {
      await removePin(pin);
    }
  } catch {
    // A shell without the route has no pins; one that fails keeps the pin,
    // and launching it says the board is gone.
  }
}
