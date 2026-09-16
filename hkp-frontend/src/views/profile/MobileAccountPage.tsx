import { ChevronLeft } from "lucide-react";

import { M } from "../playground/mobile/tokens";
import AccountPage from "./AccountPage";

type Props = {
  /** Leaves the account and returns to whatever the host was showing. */
  onBack: () => void;
};

/**
 * The account page as the touch hosts frame it: a full screen with a back
 * control, rather than a page under a toolbar. Same content as the desktop
 * page — only the frame differs, which is the whole reason `AccountPage`
 * renders no chrome of its own.
 */
export default function MobileAccountPage({ onBack }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
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
          Account
        </span>
      </div>

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
        <AccountPage />
      </div>
    </div>
  );
}
