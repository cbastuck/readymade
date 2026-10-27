import { useState, type CSSProperties } from "react";
import { Globe, KeyRound, Plus, Server } from "lucide-react";

import { secretReference } from "hkp-frontend/src/core/secrets";
import BottomSheet from "../playground/mobile/BottomSheet";
import MobilePage from "../playground/mobile/MobilePage";
import { M } from "../playground/mobile/tokens";
import { SecretsHost, parseAudience, useSecrets } from "./secretsModel";

type Props = {
  /** The host's secret store; the native apps pass their backend. */
  host: () => Promise<SecretsHost>;
  onBack: () => void;
  /** Where this host keeps what is set here, said in its own terms. */
  storageNote: string;
  zIndex?: number;
};

/** What the sheet is open for: a new secret, or one already held. */
type Sheet = { kind: "add" } | { kind: "edit"; alias: string; audience: string[] };

/** An audience that has not been set yet is worth noticing, not alarming. */
const WARN = "#b45309";

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${M.borderStrong}`,
  background: M.bg,
  color: M.textPrimary,
  // >= 16px so iOS Safari does not auto-zoom into the field.
  fontSize: 16,
  fontFamily: "inherit",
  outline: "none",
};

const mono: CSSProperties = {
  fontFamily: "'DM Mono', ui-monospace, monospace",
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: M.textMuted,
  margin: "20px 4px 8px",
};

const list: CSSProperties = {
  background: M.card,
  border: `1px solid ${M.border}`,
  borderRadius: 12,
  overflow: "hidden",
};

function primaryButton(enabled: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: "none",
    background: enabled ? M.teal : M.border,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: enabled ? "pointer" : "default",
  };
}

/** Typed by hand, for a machine to read: no capitals, no corrections. */
const literalField = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
} as const;

function audienceText(audience: string[]): string {
  return audience.length
    ? audience.join(", ")
    : "any host — pinned to the first one it is sent to";
}

/**
 * The secrets this phone holds, for the boards that refer to them.
 *
 * The desktop's settings tab, on a phone: the same model (`useSecrets`), laid
 * out as a list with a sheet per secret. A value goes in and never comes back
 * out — the sheet replaces one, it does not show it. The audience is shown,
 * because it is the part worth checking: a secret pinned to `imap.gmail.com`
 * is refused everywhere else, on this phone and in every runtime it is pushed
 * to.
 */
export default function MobileSecretsPage({ host, onBack, storageNote, zIndex = 61 }: Props) {
  const { entries, supported, constrainable, grants, error, setError, save, remove, revoke } =
    useSecrets(host);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alias, setAlias] = useState("");
  const [value, setValue] = useState("");
  const [hosts, setHosts] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const openSheet = (next: Sheet) => {
    setError("");
    setSheet(next);
    setAlias(next.kind === "edit" ? next.alias : "");
    setValue("");
    setHosts(next.kind === "edit" ? next.audience.join(", ") : "");
    setConfirmRemove(false);
    setSheetOpen(true);
  };

  // What was wrong with the last attempt stops applying once it is changed.
  const edit = (set: (text: string) => void, text: string) => {
    setError("");
    set(text);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setError("");
  };

  const submit = async () => {
    if (!sheet) {
      return;
    }
    let saved: boolean;
    if (sheet.kind === "add") {
      const typed = parseAudience(hosts);
      saved = await save({
        alias: alias.trim(),
        value,
        // Blank pins it on first use, as the hint says.
        audience: typed.length ? typed : undefined,
      });
    } else {
      const typed = parseAudience(hosts);
      const changed = typed.join(",") !== sheet.audience.join(",");
      if (!value && !changed) {
        closeSheet();
        return;
      }
      saved = await save({
        alias: sheet.alias,
        // Blank keeps the value it has.
        value: value || undefined,
        audience: changed ? typed : undefined,
      });
    }
    if (saved) {
      closeSheet();
    }
  };

  const removeHeld = async (name: string) => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    if (await remove(name)) {
      closeSheet();
    }
  };

  const typedAlias = alias.trim();
  const canSubmit = sheet?.kind === "add" ? !!typedAlias && !!value : true;

  const body = () => {
    if (entries === null) {
      return <p style={{ color: M.textSecondary, fontSize: 14 }}>Loading…</p>;
    }
    if (!supported) {
      return (
        <p style={{ color: M.textSecondary, fontSize: 14 }}>
          This version of the app cannot store secrets.
        </p>
      );
    }
    return (
      <>
        <p style={{ margin: "0 4px 14px", fontSize: 14, lineHeight: 1.45, color: M.textSecondary }}>
          Give a secret a name here, then refer to it from a board by that name
          instead of pasting the value in. A board written that way holds no
          credentials, so it stays safe to save and share.
        </p>
        <button type="button" onClick={() => openSheet({ kind: "add" })} style={primaryButton(true)}>
          <Plus size={16} />
          Add secret
        </button>

        <div style={sectionLabel}>Stored on this device</div>
        {entries.length === 0 ? (
          <p style={{ margin: "0 4px", fontSize: 14, color: M.textMuted }}>Nothing stored yet.</p>
        ) : (
          <div style={list}>
            {entries.map((entry, index) => (
              <button
                key={entry.alias}
                type="button"
                onClick={() =>
                  openSheet({ kind: "edit", alias: entry.alias, audience: entry.audience })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 14px",
                  border: "none",
                  borderTop: index ? `1px solid ${M.border}` : "none",
                  background: "none",
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: M.textPrimary,
                  cursor: "pointer",
                }}
              >
                <KeyRound size={17} color={M.textSecondary} style={{ flex: "0 0 auto" }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...mono, display: "block", fontSize: 14, wordBreak: "break-all" }}>
                    {secretReference(entry.alias)}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 2,
                      fontSize: 12.5,
                      color: entry.audience.length ? M.textSecondary : WARN,
                    }}
                  >
                    <Globe size={11} style={{ flex: "0 0 auto" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {audienceText(entry.audience)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {grants.length > 0 && (
          <>
            <div style={sectionLabel}>Runtimes you allowed</div>
            <p style={{ margin: "0 4px 8px", fontSize: 12.5, color: M.textSecondary }}>
              Boards allowed to hand a secret to a runtime without asking again.
              Forget one and the next board that tries will ask.
            </p>
            <div style={list}>
              {grants.map((grant, index) => (
                <div
                  key={grant.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderTop: index ? `1px solid ${M.border}` : "none",
                  }}
                >
                  <Server size={17} color={M.textSecondary} style={{ flex: "0 0 auto" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>
                      {grant.boardName}
                    </span>
                    <span
                      style={{ ...mono, display: "block", fontSize: 12, color: M.textSecondary, wordBreak: "break-all" }}
                    >
                      {grant.origin} · {grant.aliases.join(", ")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void revoke(grant.key)}
                    aria-label={`Forget ${grant.boardName}`}
                    style={{
                      border: `1px solid ${M.border}`,
                      background: M.card,
                      borderRadius: 999,
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      color: M.danger,
                      cursor: "pointer",
                    }}
                  >
                    Forget
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {error && !sheetOpen && (
          <p style={{ margin: "14px 4px 0", fontSize: 13, color: M.danger }}>{error}</p>
        )}
        <p style={{ margin: "20px 4px 0", fontSize: 12.5, lineHeight: 1.45, color: M.textMuted }}>
          {storageNote}
        </p>
      </>
    );
  };

  return (
    <MobilePage
      title="Secrets"
      onBack={onBack}
      zIndex={zIndex}
      overlay={
        <BottomSheet
          open={sheetOpen}
          onClose={closeSheet}
          title={sheet?.kind === "edit" ? secretReference(sheet.alias) : "Add secret"}
          height="auto"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8 }}>
            {sheet?.kind === "add" && (
              <input
                aria-label="Name"
                value={alias}
                placeholder="name"
                onChange={(e) => edit(setAlias, e.target.value)}
                style={{ ...input, ...mono }}
                {...literalField}
              />
            )}
            <input
              aria-label={sheet?.kind === "edit" ? "New value" : "Value"}
              type="password"
              autoComplete="off"
              value={value}
              placeholder={sheet?.kind === "edit" ? "new value — blank keeps the current one" : "value"}
              onChange={(e) => edit(setValue, e.target.value)}
              style={input}
            />
            {constrainable && (
              <input
                aria-label="Hosts"
                value={hosts}
                placeholder={
                  sheet?.kind === "edit"
                    ? "hosts — blank pins it on first use"
                    : "hosts it may be sent to — blank to pin on first use"
                }
                onChange={(e) => edit(setHosts, e.target.value)}
                style={{ ...input, ...mono }}
                {...literalField}
              />
            )}
            {error ? (
              <span style={{ fontSize: 13, color: M.danger }}>{error}</span>
            ) : (
              sheet?.kind === "add" &&
              typedAlias && (
                <span style={{ fontSize: 13, color: M.textSecondary }}>
                  Refer to it as <code style={mono}>{secretReference(typedAlias)}</code>
                </span>
              )
            )}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
              style={primaryButton(canSubmit)}
            >
              Save
            </button>
            {sheet?.kind === "edit" && (
              <button
                type="button"
                onClick={() => void removeHeld(sheet.alias)}
                style={{
                  ...primaryButton(true),
                  background: confirmRemove ? M.danger : "none",
                  color: confirmRemove ? "#fff" : M.danger,
                }}
              >
                {confirmRemove ? "Tap again to remove" : "Remove"}
              </button>
            )}
          </div>
        </BottomSheet>
      }
    >
      {body()}
    </MobilePage>
  );
}
