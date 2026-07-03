import type { CSSProperties, ReactNode } from "react";
import { User } from "lucide-react";

interface Props {
  title: string;
  /** Small chip next to the title, e.g. the version number. */
  badge?: string;
  /** Secondary part of the chip (e.g. the build hash), rendered smaller. */
  badgeDetail?: string;
  /** Logo mark; defaults to the first letter of the title on an accent tile. */
  logo?: ReactNode;
  /** Avatar initials of the logged-in user; a generic user icon when absent. */
  initials?: string;
  /** Makes the avatar clickable — log in while logged out (generic icon),
   *  log out while logged in (initials). Avatar hidden when neither this nor
   *  initials is provided. */
  onAvatarClick?: () => void;
  /** Tooltip for the avatar, e.g. "Log in" / "Log out (name)". */
  avatarTitle?: string;
  /** Label of the most recent board; hides "Continue recent" when absent. */
  recentBoardName?: string | null;
  onContinueRecent?: () => void;
  onLoadBoard?: () => void;
  onCreateBoard: () => void;
  /** Host-provided extra controls (e.g. the app menu), rendered rightmost. */
  menuSlot?: ReactNode;
}

const bar: CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "16px 26px",
  background: "#fff",
  borderBottom: "1px solid var(--st-line)",
};

export default function TopBar({
  title,
  badge,
  badgeDetail,
  logo,
  initials,
  onAvatarClick,
  avatarTitle,
  recentBoardName,
  onContinueRecent,
  onLoadBoard,
  onCreateBoard,
  menuSlot,
}: Props) {
  return (
    <header style={bar}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
      >
        {logo ?? (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--st-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 16,
              flex: "0 0 auto",
            }}
          >
            {title.charAt(0).toUpperCase()}
          </div>
        )}
        <span
          style={{
            fontWeight: 800,
            fontSize: 19,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#8b90a0",
              background: "#f0f1f4",
              padding: "3px 9px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            {badge}
            {badgeDetail && (
              <span style={{ fontSize: 9.5, fontWeight: 500, opacity: 0.7 }}>
                {badgeDetail}
              </span>
            )}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: "0 0 auto",
        }}
      >
        {recentBoardName && onContinueRecent && (
          <button
            className="st-btn st-btn-ghost"
            title={`Continue “${recentBoardName}”`}
            onClick={onContinueRecent}
          >
            <span style={{ color: "var(--st-accent)", fontWeight: 800 }}>
              &#8635;
            </span>{" "}
            Continue recent
          </button>
        )}
        {onLoadBoard && (
          <button className="st-btn st-btn-ghost" onClick={onLoadBoard}>
            Load board
          </button>
        )}
        <button className="st-btn st-btn-primary" onClick={onCreateBoard}>
          <span style={{ fontSize: 17, lineHeight: 0, fontWeight: 700 }}>
            +
          </span>{" "}
          Create board
        </button>
        {menuSlot}
        {(initials || onAvatarClick) && (
          <button
            title={avatarTitle}
            onClick={onAvatarClick}
            disabled={!onAvatarClick}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: initials ? "#14161c" : "transparent",
              color: initials ? "#fff" : "#6b7080",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "inherit",
              marginLeft: 6,
              cursor: onAvatarClick ? "pointer" : "default",
              flex: "0 0 auto",
            }}
          >
            {initials ?? <User size={19} strokeWidth={1.75} />}
          </button>
        )}
      </div>
    </header>
  );
}
