/**
 * The app's chrome, out of the way while the facade is the whole app.
 *
 * A board shown as its facade alone is being used rather than built, and
 * everything the window puts around it — the board menu, the view switcher,
 * the account controls, the copyright — belongs to the level above that. It
 * is not removed, because the way back to the board has to stay somewhere:
 * the bar retracts to the logo it already starts with, and clicking that mark
 * brings it back.
 *
 * It comes back **over** the facade rather than beside it. A bar that takes
 * its height back out of the flow reflows the facade every time it is shown
 * and again when it hides — widgets jump, a canvas resizes, a scrolled panel
 * shifts — so the facade's height is the same in both states and the bar is
 * painted on top of it.
 *
 * The retracted mark floats over a corner rather than sitting in a strip of
 * its own, so the facade keeps every pixel of the window and not just the ones
 * the bar was using. The corner it floats over is the top **right**, which is
 * not where the bar's own logo sits: a facade is laid out from its top left,
 * so that is where its first control is and the one corner a floating mark is
 * most likely to land on something. The opposite corner is empty in every
 * layout that does not deliberately fill it, and the app's toasts are at the
 * bottom right rather than the top.
 *
 * It is still drawn on a chip of the facade's own ground, faded out at its
 * edge, so a control that does end up underneath is dimmed rather than hidden
 * and the mark stays readable over whatever lands there.
 *
 * What puts it away again is a pointer or a focus landing outside it — not
 * the pointer leaving its bounds. Nearly everything in that bar opens a menu,
 * and those menus are portalled to the document rather than drawn inside the
 * bar, so a pointer on its way to a menu item is a pointer outside the bar:
 * dismissing on exit would retract it out from under the menu it just opened.
 * Reading a portalled menu as part of the bar makes one rule that holds for a
 * mouse and for a finger alike, which is also the rule a touch host would
 * have needed on its own.
 *
 * Escape works in both directions. A key that only put the bar away would
 * leave the way back to the board resting on finding a small mark in a
 * corner, and both directions are the same act: what Escape dismisses is
 * whichever of the two states is currently in the way.
 */
import { ReactNode, useEffect, useRef, useState } from "react";

import { useBoardContext } from "../BoardContext";
import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";

import { boardHasFacade, useFacadeView } from "./FacadeViewContext";

/** How long the bar takes to come in or go out, in ms. */
const SLIDE_MS = 180;

/** The retracted mark, in px — the chip, not the mark drawn inside it. */
const MARK = 30;

/**
 * Whether the chrome around the board is retracted.
 *
 * True only while the facade is both the whole view and a finished thing to
 * look at: a board with no facade has nothing to use yet, and an open editor
 * means the facade is being built, which is the level the chrome is for.
 */
export function useChromeRetracted(): boolean {
  const view = useFacadeView();
  const boardContext = useBoardContext();

  if (!view || view.mode !== "facade" || view.editorOpen) {
    return false;
  }
  return boardHasFacade(boardContext);
}

/**
 * Whether an event belongs to the bar, including the menus it opens.
 *
 * Radix portals a dropdown's content to the end of the document, so the
 * element under the pointer is not a descendant of the bar even while the
 * menu it belongs to was opened from one of the bar's own buttons.
 */
function isInsideChrome(bar: HTMLElement | null, target: EventTarget | null) {
  if (!(target instanceof Node)) {
    return false;
  }
  if (bar?.contains(target)) {
    return true;
  }
  const el =
    target instanceof Element ? target : (target.parentElement ?? null);
  return !!el?.closest(
    "[data-radix-popper-content-wrapper],[data-radix-portal],[role='menu'],[role='dialog']",
  );
}

/**
 * Whether something on screen is already going to act on Escape.
 *
 * An open dialog or menu closes on this key, and a person pressing it means
 * that one thing rather than the chrome behind it.
 */
function escapeIsSpokenFor() {
  return !!document.querySelector(
    "[data-radix-popper-content-wrapper],[data-radix-portal],[role='dialog'],[role='menu']",
  );
}

/**
 * Wraps the window's top bar so it can retract while the facade is the app.
 *
 * A host that mounts no facade view provider, or a board that is not in that
 * state, gets its bar exactly as it passed it in.
 */
export default function FacadeChrome({ children }: { children: ReactNode }) {
  const retracted = useChromeRetracted();
  const [revealed, setRevealed] = useState(false);
  const [hover, setHover] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Switching back to the board, or opening the editor, puts the bar back in
  // the flow — where "revealed" means nothing and must not be what it opens
  // with the next time the facade is on its own.
  useEffect(() => {
    if (!retracted) {
      setRevealed(false);
    }
  }, [retracted]);

  useEffect(() => {
    if (!retracted || !revealed) {
      return;
    }
    const dismiss = (ev: Event) => {
      if (!isInsideChrome(barRef.current, ev.target)) {
        setRevealed(false);
      }
    };
    // Captured, so a handler that stops the event on its way up — a facade
    // widget, a service panel — cannot leave the bar standing.
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("focusin", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("focusin", dismiss, true);
    };
  }, [retracted, revealed]);

  // Escape works in both directions, so the chrome has a way in and out that
  // does not depend on finding a small mark in a corner — which is the state
  // a person is in when they have been using the facade and now want the
  // board. It reads as a dismissal either way: what it puts away is the
  // retracted state itself.
  useEffect(() => {
    if (!retracted) {
      return;
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.isComposing) {
        return;
      }
      if (revealed) {
        // Said to be handled, or the host beeps: a key event that reaches a
        // native shell with its default intact is one nothing claimed, and
        // macOS answers that with the no-responder sound. Only the presses
        // actually acted on are claimed — the ones passed over below belong
        // to whatever else is listening.
        ev.preventDefault();
        setRevealed(false);
        return;
      }
      // Something on the facade is already holding this key — a dialog, a
      // menu, a select. That has the first claim on it, and a second press
      // once it has closed reaches here.
      if (escapeIsSpokenFor()) {
        return;
      }
      ev.preventDefault();
      setRevealed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [retracted, revealed]);

  if (!retracted) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        data-facade-chrome-reveal
        title="Show the board controls"
        aria-label="Show the board controls"
        aria-expanded={revealed}
        onClick={() => setRevealed(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          zIndex: 190,
          width: MARK,
          height: MARK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          padding: 0,
          // The facade's own ground, faded to nothing at the edge rather than
          // cut off at one: a hard chip would read as a control of the
          // facade's, and an opaque one would hide what it covers instead of
          // letting it show through.
          background: hover
            ? "hsl(var(--background, 0 0% 100%))"
            : "radial-gradient(circle at 50% 50%, hsl(var(--background, 0 0% 100%) / 0.92) 55%, hsl(var(--background, 0 0% 100%) / 0) 78%)",
          borderRadius: "50%",
          cursor: "pointer",
          transition: "background 120ms ease",
          // Under the bar while it is out, and out of the tab order with it.
          visibility: revealed ? "hidden" : "visible",
        }}
      >
        <IconH width={20} height={20} className="stroke-[#333]" />
      </button>

      <div
        ref={barRef}
        data-facade-chrome-bar
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          transform: revealed ? "translateY(0)" : "translateY(-100%)",
          opacity: revealed ? 1 : 0,
          boxShadow: revealed ? "0 6px 18px rgba(0,0,0,0.12)" : "none",
          // Out of the tab order while it is out of sight, and out of the way
          // of the facade's own clicks.
          visibility: revealed ? "visible" : "hidden",
          pointerEvents: revealed ? "auto" : "none",
          transition: revealed
            ? `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease`
            : `transform ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease, visibility 0s linear ${SLIDE_MS}ms`,
        }}
      >
        {children}
      </div>
    </>
  );
}
