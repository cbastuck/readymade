import { ReactNode } from "react";
import { X } from "lucide-react";

import Toolbar from "hkp-frontend/src/components/Toolbar";
import BoardProvider from "hkp-frontend/src/BoardContext";
import { useLocation, useNavigate } from "hkp-frontend/src/router";

import AccountPage from "./AccountPage";

export { default as AccountPage } from "./AccountPage";
export { default as MobileAccountPage } from "./MobileAccountPage";
export { default as AccountDialog } from "./AccountDialog";

type Props = {
  /** Top-left logo. Hosts pass a control that navigates home; without one the
   *  Toolbar renders a decorative mark that looks clickable but is not. */
  logoSlot?: ReactNode;
  /**
   * Leaving the account. Hosts that decide what is showing from something
   * other than the URL alone pass their own way back; without one this goes
   * back a step in history, which is where the account was opened from.
   */
  onClose?: () => void;
};

/**
 * Closing the account, for a host that has not said how.
 *
 * Going back a step lands wherever the avatar was clicked — a board, the start
 * page, anywhere. Except when there is no step to go back to: the account was
 * opened directly, by a link or a reload, and back would leave the app
 * altogether. `location.key` is "default" only for the entry a session started
 * on, which is exactly that case; there, home is the honest answer.
 */
function useClose(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === "default") {
      navigate("/");
    } else {
      navigate(-1);
    }
  };
}

/**
 * The account page as a host with a toolbar frames it: the toolbar above, the
 * account itself in a readable column below. Reached from the toolbar avatar,
 * from the app menu, and from the start page's avatar.
 *
 * The BoardProvider is here because the toolbar's board menu reads one; this
 * page owns no board, so it gets an empty one.
 */
export default function Profile({ logoSlot, onClose }: Props) {
  const closeByHistory = useClose();
  const close = onClose ?? closeByHistory;

  return (
    <BoardProvider user={null} availableRuntimeEngines={[]} runtimeApis={{}}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          background: "var(--surface-sunken, #f7f8fa)",
        }}
      >
        <Toolbar logoSlot={logoSlot} />
        <div
          style={{
            width: "100%",
            maxWidth: 780,
            margin: "0 auto",
            padding: "28px 20px 48px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              margin: "0 0 18px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#14161c",
              }}
            >
              Account
            </h1>
            <button
              type="button"
              onClick={close}
              title="Close"
              aria-label="Close"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                border: "1px solid var(--border-mid, #e3e5ea)",
                borderRadius: 8,
                background: "#fff",
                color: "#6b7080",
                padding: 0,
                cursor: "pointer",
                flex: "0 0 auto",
              }}
            >
              <X size={17} strokeWidth={1.9} />
            </button>
          </div>
          <AccountPage />
        </div>
      </div>
    </BoardProvider>
  );
}
