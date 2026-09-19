import { useState } from "react";
import { User } from "lucide-react";

import { useAppContext } from "hkp-frontend/src/AppContext";
import {
  useCanCloudLogin,
  useCloudLogin,
} from "hkp-frontend/src/auth/useCloudLogin";
import { useUserProfile } from "hkp-frontend/src/core/userProfile";
import { initialsOf } from "hkp-frontend/src/views/start";
import AccountDialog from "hkp-frontend/src/views/profile/AccountDialog";

/**
 * The signed-in user's avatar for the playground toolbar — the same login-state
 * indicator the Start page shows in its top bar, so the two views stay
 * consistent and it's obvious at a glance whether you're logged in.
 *
 * Initials on a filled tile when signed in, a generic user icon when signed
 * out. Clicking opens the account (signed in) or logs in (signed out) via the
 * platform-agnostic cloud hook, so it behaves the same in the website and the
 * native Readymade webview. Signing out is on the account and in the app menu:
 * it is the one thing here that cannot be undone by clicking again, so it does
 * not belong on the control someone reaches for to look at their account.
 *
 * The account opens over the board rather than instead of it. This control sits
 * in a board's own toolbar, and a board is live state — runtimes running,
 * unsaved edits held nowhere else — so a view that replaced it would throw that
 * away for a glance at a profile.
 *
 * The initials follow the display name someone set on the account page, falling
 * back to the name in the token.
 *
 * Nothing is rendered when nobody is signed in and this host cannot sign anyone
 * in — the webapp served on a LAN address, which is how a second device reaches
 * a shared board. There the visitor is authorized by the board's own capability
 * token, so a login control would be an invitation to a dead end.
 */
export default function AccountAvatar() {
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const canLogin = useCanCloudLogin();
  const profile = useUserProfile(user?.userId);
  const [isAccountOpen, setAccountOpen] = useState(false);

  const name = profile.displayName || user?.username;
  const initials = initialsOf(name);
  const isLoggedIn = !!user;
  if (!isLoggedIn && !canLogin) {
    return null;
  }
  const title = isLoggedIn ? `Account${name ? ` (${name})` : ""}` : "Log in";

  return (
    <>
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={() => (isLoggedIn ? setAccountOpen(true) : void cloudLogin())}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "none",
          background: isLoggedIn ? "#14161c" : "transparent",
          color: isLoggedIn ? "#fff" : "var(--text-dim, #6b7080)",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
          fontFamily: "inherit",
          cursor: "pointer",
          flex: "0 0 auto",
          backgroundImage: profile.avatarUrl
            ? `url(${profile.avatarUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {profile.avatarUrl
          ? null
          : (initials ?? <User size={17} strokeWidth={1.75} />)}
      </button>
      <AccountDialog open={isAccountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}
