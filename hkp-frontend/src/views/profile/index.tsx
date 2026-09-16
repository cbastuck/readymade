import { ReactNode } from "react";

import Toolbar from "hkp-frontend/src/components/Toolbar";
import BoardProvider from "hkp-frontend/src/BoardContext";

import AccountPage from "./AccountPage";

export { default as AccountPage } from "./AccountPage";
export { default as MobileAccountPage } from "./MobileAccountPage";

type Props = {
  /** Top-left logo. Hosts pass a control that navigates home; without one the
   *  Toolbar renders a decorative mark that looks clickable but is not. */
  logoSlot?: ReactNode;
};

/**
 * The account page as a host with a toolbar frames it: the toolbar above, the
 * account itself in a readable column below. Reached from the toolbar avatar,
 * from the app menu, and from the start page's avatar.
 *
 * The BoardProvider is here because the toolbar's board menu reads one; this
 * page owns no board, so it gets an empty one.
 */
export default function Profile({ logoSlot }: Props) {
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
          <h1
            style={{
              margin: "0 0 18px",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#14161c",
            }}
          >
            Account
          </h1>
          <AccountPage />
        </div>
      </div>
    </BoardProvider>
  );
}
