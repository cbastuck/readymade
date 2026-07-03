import { useEffect, useState } from "react";

import { useAppContext } from "../../../AppContext";
import { useCloudLogin } from "../../../auth/useCloudLogin";
import { useCloudLogout } from "../../../auth/useCloudLogout";
import { usePlatform } from "../../../platform/PlatformContext";
import BottomSheet from "./BottomSheet";
import MobileIcon, { type MobileIconName } from "./MobileIcon";
import RuntimeAccessSheet from "./RuntimeAccessSheet";
import { M } from "./tokens";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  onNew: () => void;
};

function MenuRow({
  icon,
  iconColor,
  label,
  sublabel,
  onClick,
}: {
  icon: MobileIconName;
  iconColor: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 14px",
        width: "100%",
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: M.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MobileIcon name={icon} size={18} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: M.textPrimary }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 12, color: M.textMuted, marginTop: 1 }}>
            {sublabel}
          </div>
        )}
      </div>
    </button>
  );
}

export default function BoardMenuSheet({
  open,
  onClose,
  onSave,
  onShare,
  onNew,
}: Props) {
  const [confirmNew, setConfirmNew] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const { user } = useAppContext();
  const cloudLogin = useCloudLogin();
  const cloudLogout = useCloudLogout();
  const platform = usePlatform();
  const canEditAccess = !!platform.getRuntimeSettings;

  // Forget any pending "new board" confirmation whenever the menu closes.
  useEffect(() => {
    if (!open) {
      setConfirmNew(false);
    }
  }, [open]);

  return (
    <>
    <BottomSheet open={open} onClose={onClose} title="Board" height="auto">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <MenuRow
          icon="check"
          iconColor={M.tealDark}
          label="Save board"
          sublabel="Keep this board on your device"
          onClick={() => {
            onClose();
            onSave();
          }}
        />
        <MenuRow
          icon="share"
          iconColor={M.blue}
          label="Share link"
          sublabel="Copy a link to this board"
          onClick={() => {
            onClose();
            onShare();
          }}
        />

        {confirmNew ? (
          <div
            style={{
              padding: 14,
              border: `1px solid ${M.danger}`,
              borderRadius: 12,
              background: "#fef2f2",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, color: "#991b1b", lineHeight: 1.4 }}>
              Start a new board? Unsaved changes to the current board will be
              lost.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmNew(false)}
                style={{
                  flex: 1,
                  height: 42,
                  border: `1px solid ${M.border}`,
                  borderRadius: 10,
                  background: M.card,
                  color: M.textSecondary,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClose();
                  onNew();
                }}
                style={{
                  flex: 1,
                  height: 42,
                  border: "none",
                  borderRadius: 10,
                  background: M.danger,
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                New board
              </button>
            </div>
          </div>
        ) : (
          <MenuRow
            icon="plus"
            iconColor={M.textSecondary}
            label="New board"
            sublabel="Clear and start fresh"
            onClick={() => setConfirmNew(true)}
          />
        )}

        {canEditAccess && (
          <MenuRow
            icon="lock"
            iconColor={M.textSecondary}
            label="Runtime access"
            sublabel="Expose to LAN, manage allowed users"
            onClick={() => {
              onClose();
              setAccessOpen(true);
            }}
          />
        )}

        {user ? (
          <MenuRow
            icon="user"
            iconColor={M.textSecondary}
            label="Log out"
            sublabel={user.username || "Signed in"}
            onClick={() => {
              onClose();
              void cloudLogout();
            }}
          />
        ) : (
          <MenuRow
            icon="user"
            iconColor={M.blue}
            label="Login"
            sublabel="Sign in to your account"
            onClick={() => {
              onClose();
              void cloudLogin();
            }}
          />
        )}
      </div>
    </BottomSheet>
    <RuntimeAccessSheet open={accessOpen} onClose={() => setAccessOpen(false)} />
    </>
  );
}
