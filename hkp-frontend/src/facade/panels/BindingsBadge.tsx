import { RefObject, useLayoutEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";

import { BindingSite } from "../bindings";
import { useFacadeBindings } from "../FacadeBindingsContext";
import { useFacadeView } from "../FacadeViewContext";

/**
 * The corner badge on a facade widget: it opens the facade editor on that
 * widget, where what it acts on and is updated by sits beside everything else
 * about it that can be changed.
 *
 * Positioned over the widget rather than beside it, so the facade's layout is
 * the same with and without badges; faint until the widget is hovered or
 * focused, and always shown on a screen with no hover (see index.css). Only the
 * badge itself takes clicks, so a canvas or a pad under it keeps working.
 */

const BADGE_SIZE = 18;
/** Elements measured by their own box, whatever is inside them. */
const CONTROL_TAGS = /^(BUTTON|INPUT|TEXTAREA|SELECT|CANVAS|SVG|VIDEO|IMG)$/i;
/** Past this many elements a widget is measured by its wrapper instead. */
const MEASURE_LIMIT = 400;

function textRect(element: Element): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect?.();
  return rect && rect.width > 0 ? rect : element.getBoundingClientRect();
}

/**
 * Where the widget's visible content ends, relative to the wrapper the badge
 * is placed against.
 *
 * A widget's wrapper stretches across its column, so its corner is usually
 * far from anything drawn — a button sits at the left of a row the width of
 * the panel. The corner is taken instead from the extent of what the widget
 * draws: the elements with nothing inside them, and the controls. Measured
 * rather than laid out differently, so the facade looks the same with and
 * without badges.
 */
function useContentCorner(
  badgeRef: RefObject<HTMLButtonElement | null>,
): { top: number; left: number } | null {
  const [corner, setCorner] = useState<{ top: number; left: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const badge = badgeRef.current;
    const host = badge?.parentElement;
    if (!badge || !host) {
      return;
    }
    const measure = () => {
      const hostRect = host.getBoundingClientRect();
      let right = -Infinity;
      let top = Infinity;
      const all = host.querySelectorAll("*");
      if (all.length <= MEASURE_LIMIT) {
        all.forEach((element) => {
          if (badge === element || badge.contains(element)) {
            return;
          }
          const control = CONTROL_TAGS.test(element.tagName);
          const drawn = control || element.childElementCount === 0;
          if (!drawn) {
            return;
          }
          // Text is measured as text: a line of it usually sits in a block
          // as wide as the column. A control is measured by its own box,
          // padding and all — a button's label sits inside its face.
          const rect =
            !control && element.childElementCount === 0 && element.textContent
              ? textRect(element)
              : element.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) {
            return;
          }
          right = Math.max(right, rect.right);
          top = Math.min(top, rect.top);
        });
      }
      if (!Number.isFinite(right)) {
        right = hostRect.right;
        top = hostRect.top;
      }
      // Centred on the content's top-right corner: only its bottom-left
      // quarter lies over the widget, so it reads as the widget's own without
      // covering anything worth pressing — a button's face least of all.
      let nextTop = top - hostRect.top - BADGE_SIZE / 2;
      let nextLeft = right - hostRect.left - BADGE_SIZE / 2;
      // A wrapper that clips its content would clip the badge too, so there it
      // is kept inside.
      if (getComputedStyle(host).overflow === "hidden") {
        nextTop = Math.max(0, nextTop);
        nextLeft = Math.min(nextLeft, hostRect.width - BADGE_SIZE);
      }
      const next = { top: nextTop, left: Math.max(0, nextLeft) };
      setCorner((prev) =>
        prev && prev.top === next.top && prev.left === next.left ? prev : next,
      );
    };
    measure();
    // A web font arriving late changes how wide text is without resizing
    // anything observed below; hovering is when the badge is looked at.
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    host.addEventListener("pointerenter", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => {
        live = false;
        host.removeEventListener("pointerenter", measure);
      };
    }
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(host);
    Array.from(host.children).forEach((child) => {
      if (child !== badge) {
        observer.observe(child);
      }
    });
    return () => {
      live = false;
      host.removeEventListener("pointerenter", measure);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [badgeRef]);
  return corner;
}

export const BADGE_LABEL = "Open in the facade editor";

export function BindingsBadge({ site }: { site: BindingSite }) {
  const api = useFacadeBindings();
  const view = useFacadeView();
  const badgeRef = useRef<HTMLButtonElement>(null);
  const corner = useContentCorner(badgeRef);

  if (!api?.badges || !view) {
    return null;
  }

  return (
    <button
      ref={badgeRef}
      type="button"
      className="hkp-binding-badge"
      style={corner ? { top: corner.top, left: corner.left, right: "auto" } : undefined}
      aria-label={BADGE_LABEL}
      title="Open in the facade editor — what this acts on, what updates it, and its properties"
      onClick={() => view.openEditorAt({ kind: "widget", site })}
    >
      <Link2 size={11} />
    </button>
  );
}
