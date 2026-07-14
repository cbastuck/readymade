import { User } from "lucide-react";

import { useAppContext } from "hkp-frontend/src/AppContext";
import { useCloudLogin } from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import { initialsOf } from "hkp-frontend/src/views/start";

/**
 * The signed-in user's avatar for the playground toolbar — the same login-state
 * indicator the Start page shows in its top bar, so the two views stay
 * consistent and it's obvious at a glance whether you're logged in.
 *
 * Initials on a filled tile when signed in, a generic user icon when signed
 * out. Clicking logs in (signed out) or logs out (signed in) via the
 * platform-agnostic cloud hooks, so it behaves the same in the website and the
 * native Meander/Readymade webview.
 */
export default function AccountAvatar() {
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const cloudLogout = useCloudLogout();

  const initials = initialsOf(user?.username);
  const isLoggedIn = !!user;
  const title = isLoggedIn
    ? `Log out${user?.username ? ` (${user.username})` : ""}`
    : "Log in";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => void (isLoggedIn ? cloudLogout() : cloudLogin())}
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
      }}
    >
      {initials ?? <User size={17} strokeWidth={1.75} />}
    </button>
  );
}
