import { createContext, useContext } from "react";

import { setCapturing, useCapturing } from "../../../runtime/captureMode";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";

/**
 * Capture mode as the mobile canvas switches it (`runtime/captureMode`,
 * `plans/TODO-CAPTURE-MODE.md`).
 *
 * A board running here is switched in this window, as on the desktop. A
 * deployed board is switched where it runs: its coordinator holds the switch,
 * and the canvas of a cloud board is handed one that asks it
 * (`MobileCloudBoards`). Either way it is never saved.
 */
export type CaptureControl = {
  on: boolean;
  /** A change on its way, for a switch that has to ask somebody. */
  busy?: boolean;
  set: (on: boolean) => void;
};

export const CaptureControlContext = createContext<CaptureControl | null>(null);

/** The switch for the board on screen: a cloud board's, else this window's. */
export function useCaptureControl(): CaptureControl {
  const provided = useContext(CaptureControlContext);
  const local = useCapturing();
  return provided ?? { on: local, set: setCapturing };
}

/** What Capture mode means, for the switch's label. */
export function captureTitle(on: boolean): string {
  return on
    ? "Capture mode is on: each service's input and output is reported as it runs. Tap to turn it off."
    : "Capture mode is off: services show that they ran, not what they received or passed on.";
}

/** The switch as a top bar control, the size of the buttons beside it. */
export function CaptureButton({ control }: { control: CaptureControl }) {
  const { on, busy, set } = control;
  return (
    <button
      onClick={() => set(!on)}
      disabled={busy}
      aria-label="Capture mode"
      aria-pressed={on}
      title={captureTitle(on)}
      style={{
        width: 34,
        height: 34,
        border: "none",
        background: on ? "#fdecec" : "rgba(0,0,0,0.06)",
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <MobileIcon
        name="record"
        size={16}
        color={on ? M.danger : M.textSecondary}
        // The dot filled while values are being sent, as on the desktop.
        style={{ fill: on ? M.danger : "none" }}
      />
    </button>
  );
}
