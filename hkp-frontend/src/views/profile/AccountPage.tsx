import { CSSProperties, useEffect, useState } from "react";
import { BadgeAlert, BadgeCheck, LogIn, LogOut, User } from "lucide-react";

import { useAppContext } from "hkp-frontend/src/AppContext";
import { claimsOf } from "hkp-frontend/src/core/Auth";
import {
  UserProfile,
  useEditableUserProfile,
} from "hkp-frontend/src/core/userProfile";
import {
  useCanCloudLogin,
  useCloudLogin,
} from "hkp-frontend/src/auth/useCloudLogin";
import { useCloudLogout } from "hkp-frontend/src/auth/useCloudLogout";
import { initialsOf } from "../start/model";

/**
 * The signed-in person's account, in two halves that are not the same kind of
 * thing.
 *
 * What the identity provider asserts — name, email, who verified it, which
 * account it is — is read-only here: it arrives signed inside the OIDC
 * id_token, and this app has no way to write it back. What the app itself keeps
 * about a person is editable and lives beside the token; see `core/userProfile`
 * for why the two are separated and what changes when the Management API
 * becomes reachable.
 *
 * Host-agnostic on purpose: it renders no toolbar and no chrome of its own, so
 * the playground can frame it as a page and another host can frame it however
 * it frames a page. Signing in and out go through the platform-agnostic cloud
 * hooks, so the native app and the website behave the same.
 */

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#8b90a0",
};

const sectionTitle: CSSProperties = {
  ...label,
  marginBottom: 14,
};

const card: CSSProperties = {
  border: "1px solid var(--border-mid, #e3e5ea)",
  borderRadius: 12,
  background: "#fff",
  padding: "20px 22px",
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--border-mid, #d8dae0)",
  borderRadius: 8,
  padding: "8px 10px",
  // Anything under 16 makes iOS zoom the page on focus and never zoom back.
  fontSize: 16,
  fontFamily: "inherit",
  color: "#14161c",
  background: "#fff",
};

const button: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid var(--border-mid, #d8dae0)",
  borderRadius: 8,
  background: "#fff",
  color: "#14161c",
  padding: "8px 14px",
  fontSize: 13.5,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};

/** One read-only claim. Absent claims are left out rather than shown empty:
 *  which claims a token carries depends on the connection someone signed in
 *  with, and a column of blanks says nothing about the account. */
function Claim({ name, value }: { name: string; value?: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <div style={label}>{name}</div>
      <div
        style={{
          marginTop: 3,
          fontSize: 13.5,
          color: "#3a3f4c",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Avatar({ src, initials }: { src?: string; initials?: string }) {
  const size = 64;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flex: "0 0 auto",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#14161c",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 22,
        flex: "0 0 auto",
      }}
    >
      {initials ?? <User size={28} strokeWidth={1.6} />}
    </div>
  );
}

/** A date claim as something readable, or undefined when it is neither an ISO
 *  date nor a numeric timestamp. */
function readableDate(value?: string | number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
}

/** What someone signed in with, as Auth0 encodes it in the subject
 *  (`google-oauth2|1234`, `auth0|1234`). */
function connectionOf(sub?: string): string | undefined {
  const connection = sub?.split("|")[0];
  if (!connection) {
    return undefined;
  }
  return connection === "auth0" ? "Email and password" : connection;
}

function SignedOut() {
  const cloudLogin = useCloudLogin();
  const canLogin = useCanCloudLogin();
  return (
    <div style={{ ...card, textAlign: "center", padding: "40px 22px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#14161c" }}>
        Nobody is signed in
      </div>
      <div style={{ marginTop: 6, fontSize: 13.5, color: "#6b7080" }}>
        {canLogin
          ? "Sign in to see and edit your account."
          : "This page is served from a local network address, which the sign-in provider will not redirect back to."}
      </div>
      {canLogin && (
        <button
          type="button"
          style={{ ...button, marginTop: 18 }}
          onClick={() => void cloudLogin()}
        >
          <LogIn size={14} strokeWidth={1.8} />
          Sign in
        </button>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { user } = useAppContext();
  const cloudLogout = useCloudLogout();
  const [profile, saveProfile] = useEditableUserProfile(user?.userId);

  // The form is a draft of the stored profile rather than the profile itself,
  // so a half-typed name is not what the rest of the app shows. Re-seeded when
  // the stored profile changes — a different user signing in, an edit in
  // another tab.
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  if (!user) {
    return <SignedOut />;
  }

  const claims = claimsOf(user.idToken);
  const displayName = profile.displayName || claims.nickname || user.username;
  const picture = profile.avatarUrl || user.picture;
  const expiresAt = readableDate(claims.exp);
  const expired = typeof claims.exp === "number" && claims.exp * 1000 < Date.now();

  const edit = (field: keyof UserProfile) => (value: string) => {
    setSaved(false);
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const onSave = () => {
    saveProfile(draft);
    setSaved(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Who this is */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 18 }}>
        <Avatar src={picture} initials={initialsOf(displayName)} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#14161c",
            }}
          >
            {displayName ?? "Signed in"}
          </div>
          {(claims.email ?? user.email) && (
            <div
              style={{
                marginTop: 3,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13.5,
                color: "#6b7080",
              }}
            >
              <span style={{ wordBreak: "break-all" }}>
                {claims.email ?? user.email}
              </span>
              {claims.email_verified ? (
                <BadgeCheck
                  size={14}
                  strokeWidth={2}
                  color="#10b981"
                  aria-label="Email verified"
                />
              ) : (
                <BadgeAlert
                  size={14}
                  strokeWidth={2}
                  color="#f59e0b"
                  aria-label="Email not verified"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* What this app keeps, and what someone can change */}
      <div style={card}>
        <div style={sectionTitle}>Your profile</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label} htmlFor="profile-display-name">
              Display name
            </label>
            <input
              id="profile-display-name"
              style={{ ...input, marginTop: 5 }}
              value={draft.displayName ?? ""}
              placeholder={claims.nickname ?? user.username ?? ""}
              onChange={(e) => edit("displayName")(e.target.value)}
            />
          </div>
          <div>
            <label style={label} htmlFor="profile-avatar-url">
              Avatar image URL
            </label>
            <input
              id="profile-avatar-url"
              style={{ ...input, marginTop: 5 }}
              value={draft.avatarUrl ?? ""}
              placeholder={user.picture ?? "https://…"}
              onChange={(e) => edit("avatarUrl")(e.target.value)}
            />
          </div>
          <div>
            <label style={label} htmlFor="profile-bio">
              About
            </label>
            <textarea
              id="profile-bio"
              rows={3}
              style={{ ...input, marginTop: 5, resize: "vertical" }}
              value={draft.bio ?? ""}
              onChange={(e) => edit("bio")(e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            type="button"
            style={{ ...button, background: "#14161c", color: "#fff", borderColor: "#14161c" }}
            onClick={onSave}
          >
            Save
          </button>
          <button type="button" style={button} onClick={() => setDraft(profile)}>
            Revert
          </button>
          {saved && (
            <span style={{ fontSize: 12.5, color: "#10b981" }}>Saved</span>
          )}
        </div>

        <p style={{ marginTop: 14, fontSize: 12.5, color: "#8b90a0" }}>
          Kept in this browser, against your account. It overrides what the
          sign-in provider says — changing your name or picture with the
          provider itself is done there, not here.
        </p>
      </div>

      {/* What the provider asserts */}
      <div style={card}>
        <div style={sectionTitle}>Identity</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 16,
          }}
        >
          <Claim name="Name" value={claims.name} />
          <Claim name="Nickname" value={claims.nickname ?? user.username} />
          <Claim name="Email" value={claims.email ?? user.email} />
          <Claim name="Signed in with" value={connectionOf(user.userId)} />
          <Claim name="User ID" value={user.userId} />
          <Claim name="Issued by" value={claims.iss} />
          <Claim name="Profile updated" value={readableDate(claims.updated_at)} />
          <Claim
            name={expired ? "Session expired" : "Session expires"}
            value={expiresAt}
          />
        </div>
        <p style={{ marginTop: 16, fontSize: 12.5, color: "#8b90a0" }}>
          Read from the signed ID token this session was established with. These
          values are the identity provider&apos;s, and cannot be edited here.
        </p>
      </div>

      {/* Ending the session — the avatar used to do this, and it has to stay
          reachable somewhere obvious. */}
      <div style={card}>
        <div style={sectionTitle}>Session</div>
        <button type="button" style={button} onClick={() => void cloudLogout()}>
          <LogOut size={14} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </div>
  );
}
