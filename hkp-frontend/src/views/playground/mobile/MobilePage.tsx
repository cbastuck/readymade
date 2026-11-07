import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { M } from "./tokens";

type Props = {
  title: string;
  /** Leaves the page and returns to whatever was showing under it. */
  onBack: () => void;
  /** A page opened from another page stacks above it. */
  zIndex?: number;
  children: ReactNode;
  /** Bottom sheets the page opens, laid over the page rather than over
   *  whatever is under it. */
  overlay?: ReactNode;
};

/**
 * A full-screen page as the touch hosts frame one: a bar with a back control
 * and the title, and the content scrolling below it. Fixed and above the host,
 * because a page is raised over whatever is showing — a start page, a running
 * board — and must cover it whole without depending on an ancestor to position
 * against.
 */
export default function MobilePage({ title, onBack, zIndex = 60, children, overlay }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        flexDirection: "column",
        background: M.bg,
        color: M.textPrimary,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(242,237,232,0.92)",
          backdropFilter: "blur(12px)",
          paddingTop: "max(10px, env(safe-area-inset-top))",
          paddingBottom: 10,
          paddingLeft: 8,
          paddingRight: 16,
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderBottom: `1px solid ${M.border}`,
          flexShrink: 0,
          minHeight: 44,
          boxSizing: "content-box",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            border: "none",
            background: "none",
            padding: 8,
            display: "flex",
            alignItems: "center",
            color: M.textPrimary,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {title}
        </span>
      </div>

      <div
        style={{
          // What a bottom sheet in `overlay` positions against.
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: 16,
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
}
