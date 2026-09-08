import { CSSProperties, useState } from "react";

/**
 * The visual half of a button: what it looks like under the pointer.
 *
 * A facade widget is styled inline rather than by class, because a facade is
 * rendered by whatever is hosting the board — playground, Readymade, the
 * website — and cannot rely on a stylesheet any of them happens to load. That
 * costs it `:hover` and `:active`, which is why these are tracked here instead.
 *
 * The states earn their keep: hover says a thing is pressable before it is
 * pressed, and the press state is the only acknowledgement the person gets for
 * an action whose real effect happens somewhere else entirely — a pipeline on
 * another machine, reporting back whenever it reports back.
 */

export type PressTone =
  // Bordered, transparent-ish: the default for an action button.
  | "neutral"
  // Filled with the accent: a submit sitting at the end of an input.
  | "primary";

export type PressFeedback = {
  handlers: {
    onPointerEnter: (e: React.PointerEvent) => void;
    onPointerLeave: () => void;
    onPointerDown: () => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onKeyUp: () => void;
    onFocus: (e: React.FocusEvent) => void;
    onBlur: () => void;
  };
  /** Spread over the widget's own style, so a widget keeps its shape. */
  style: CSSProperties;
};

const TRANSITION =
  "background-color 0.12s, border-color 0.12s, color 0.12s, filter 0.12s, transform 0.06s";

function toneStyle(
  tone: PressTone,
  hover: boolean,
  press: boolean,
): CSSProperties {
  if (tone === "primary") {
    // Filled buttons are already at full colour, so pressure reads as
    // darkening rather than as a change of colour.
    return { filter: press ? "brightness(0.82)" : hover ? "brightness(0.92)" : undefined };
  }
  if (press) {
    return {
      backgroundColor: "hsl(var(--accent) / 0.14)",
      borderColor: "hsl(var(--accent))",
      color: "hsl(var(--accent))",
    };
  }
  if (hover) {
    return {
      backgroundColor: "hsl(var(--muted))",
      borderColor: "hsl(var(--accent) / 0.45)",
    };
  }
  return {};
}

export function usePressFeedback(
  tone: PressTone = "neutral",
  // A button that cannot be pressed must not look pressable — and a disabled
  // element does not reliably stop reporting pointer events, so this is decided
  // here rather than left to the browser.
  disabled = false,
): PressFeedback {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  const release = () => {
    setPress(false);
  };

  return {
    handlers: {
      onPointerEnter: (e) => {
        // A tap reports enter and never leaves, so a touch device would keep
        // the hover state long after the finger has gone.
        if (e.pointerType === "mouse") {
          setHover(true);
        }
      },
      onPointerLeave: () => {
        setHover(false);
        setPress(false);
      },
      onPointerDown: () => setPress(true),
      onPointerUp: release,
      onPointerCancel: release,
      // Space and Enter fire a click without ever touching the pointer, so
      // without this the keyboard route is the one with no feedback at all.
      onKeyDown: (e) => {
        if (e.key === " " || e.key === "Enter") {
          setPress(true);
        }
      },
      onKeyUp: release,
      onFocus: (e) => {
        // :focus-visible is the browser's own judgement of whether a focus ring
        // is wanted — asking it avoids ringing every button that is clicked.
        setKeyboardFocus(
          typeof e.currentTarget.matches === "function" &&
            e.currentTarget.matches(":focus-visible"),
        );
      },
      onBlur: () => {
        setKeyboardFocus(false);
        setPress(false);
      },
    },
    style: {
      transition: TRANSITION,
      transform: press && !disabled ? "translateY(1px)" : undefined,
      ...toneStyle(tone, hover && !disabled, press && !disabled),
      ...(keyboardFocus
        ? { outline: "none", boxShadow: "0 0 0 3px hsl(var(--accent) / 0.3)" }
        : {}),
    },
  };
}
