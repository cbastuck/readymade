import { useEffect, useRef } from "react";

// Prevents the browser's swipe-to-navigate gesture when a horizontal swipe
// reaches the boundary of this container and no inner element can absorb it.
// Must be attached to the actual scrollable element (overflow-x: auto/scroll).
export function useBlockSwipeNavigation<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      if (e.deltaX === 0) {
        return;
      }

      // Walk from the event target up to our container. If any intermediate
      // scrollable element can still absorb this delta, don't interfere — the
      // browser will scroll it normally and there is no navigation to prevent.
      let node = e.target as HTMLElement | null;
      while (node && node !== el) {
        const ox = window.getComputedStyle(node).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "overlay") {
          const canScrollLeft = e.deltaX < 0 && node.scrollLeft > 0;
          const canScrollRight =
            e.deltaX > 0 &&
            node.scrollLeft < node.scrollWidth - node.clientWidth - 1;
          if (canScrollLeft || canScrollRight) {
            return;
          }
        }
        node = node.parentElement;
      }

      // No inner element can absorb the swipe — block it only at our boundary.
      const atLeftEdge = el.scrollLeft === 0 && e.deltaX < 0;
      const atRightEdge =
        el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaX > 0;
      if (atLeftEdge || atRightEdge) {
        e.preventDefault();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return ref;
}
