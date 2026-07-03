import { useEffect, useState } from "react";

import {
  RuntimeAccessSettings,
  usePlatform,
} from "../../../platform/PlatformContext";
import BottomSheet from "./BottomSheet";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function RuntimeAccessSheet({ open, onClose }: Props) {
  const platform = usePlatform();
  const [settings, setSettings] = useState<RuntimeAccessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (!open || !platform.getRuntimeSettings) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    platform
      .getRuntimeSettings()
      .then((s) => {
        if (!cancelled) {
          setSettings(s);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, platform]);

  const persist = async (patch: Partial<RuntimeAccessSettings>) => {
    if (!platform.setRuntimeSettings) {
      return;
    }
    const updated = await platform.setRuntimeSettings(patch);
    setSettings(updated);
  };

  const addEmail = () => {
    const email = newEmail.trim();
    setNewEmail("");
    if (!email || !settings || settings.allowedUsers.includes(email)) {
      return;
    }
    void persist({ allowedUsers: [...settings.allowedUsers, email] });
  };

  const removeEmail = (email: string) => {
    if (!settings) {
      return;
    }
    void persist({
      allowedUsers: settings.allowedUsers.filter((e) => e !== email),
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Runtime access" height="auto">
      {loading || !settings ? (
        <div style={{ fontSize: 13, color: M.textMuted, padding: "8px 4px" }}>
          {loading ? "Loading…" : "Runtime settings are not available here."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Expose toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              border: `1px solid ${M.border}`,
              borderRadius: 12,
              background: M.card,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: M.textPrimary }}>
                Expose to local network
              </div>
              <div style={{ fontSize: 12, color: M.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                {settings.allowExternalRuntimeAccess
                  ? "Other devices can connect (authenticated)."
                  : "Reachable only from this device."}
              </div>
            </div>
            <button
              onClick={() =>
                void persist({
                  allowExternalRuntimeAccess: !settings.allowExternalRuntimeAccess,
                })
              }
              style={{
                flexShrink: 0,
                border: "none",
                borderRadius: 999,
                padding: "6px 14px",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: settings.allowExternalRuntimeAccess ? M.tealLight : "rgba(0,0,0,0.06)",
                color: settings.allowExternalRuntimeAccess ? M.tealDark : M.textMuted,
              }}
            >
              {settings.allowExternalRuntimeAccess ? "On" : "Off"}
            </button>
          </div>

          {/* Allow-list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: M.textMuted,
              }}
            >
              Allowed users
            </div>
            <div style={{ fontSize: 12, color: M.textMuted, lineHeight: 1.4 }}>
              Emails permitted to drive this runtime from other devices.
            </div>

            {settings.allowedUsers.length === 0 && (
              <div style={{ fontSize: 12, color: M.textMuted, fontStyle: "italic" }}>
                No users yet — while exposed, external requests are denied.
              </div>
            )}
            {settings.allowedUsers.map((email) => (
              <div
                key={email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${M.border}`,
                  borderRadius: 12,
                  background: M.card,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    color: M.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email}
                </div>
                <button
                  onClick={() => removeEmail(email)}
                  aria-label={`Remove ${email}`}
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MobileIcon name="x" size={16} color={M.textMuted} />
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addEmail();
                  }
                }}
                placeholder="name@example.com"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  flex: 1,
                  border: `1px solid ${M.border}`,
                  borderRadius: 10,
                  padding: "11px 12px",
                  fontSize: 16, // >=16 prevents iOS auto-zoom on focus
                  fontFamily: "inherit",
                  color: M.textPrimary,
                  background: M.bg,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={addEmail}
                aria-label="Add user"
                style={{
                  flexShrink: 0,
                  width: 44,
                  border: "none",
                  background: M.tealLight,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <MobileIcon name="plus" size={18} color={M.tealDark} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.4 }}>
            ⚠️ Changes take effect after restarting the app.
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
