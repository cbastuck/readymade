import { ReactNode, useState } from "react";
import { Globe, KeyRound, Plus, Server } from "lucide-react";

import {
  RemoveButton,
  SettingsButton,
  SettingsCard,
  SettingsInput,
  SettingsList,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsStack,
} from "hkp-frontend/src/ui-components/settings/kit";
import { secretReference } from "hkp-frontend/src/core/secrets";
import {
  parseAudience,
  useSecrets,
} from "hkp-frontend/src/views/secrets/secretsModel";
import type { SecretsBackend } from "hkp-frontend/src/secretsBackend";

type Props = {
  /**
   * Where the secrets are kept; asked again for every operation. A stable
   * function: the tab reloads what it lists whenever this changes.
   */
  getBackend: () => Promise<SecretsBackend>;
  /** Says where that is, and what follows from it. */
  note: ReactNode;
  /** Told once a value has been stored, so a host can hand it on. */
  onSaved?: (alias: string) => void;
};

/**
 * The values behind the aliases a board refers to.
 *
 * A board says `{{secret.gmail}}` and never what that is; this is where the
 * what lives. Values are write-only here in the same way a service treats a
 * password: they can be set and replaced, never read back — the field is for
 * putting something in, and nothing in a settings dialog needs to show a
 * credential to the person who typed it.
 *
 * The audience is not a secret and is shown, because it is the part worth
 * checking. It is what stops a board from taking a credential somewhere it has
 * never been: a secret pinned to `imap.gmail.com` is refused everywhere else,
 * here and in every runtime the value is pushed to.
 *
 * Where the values live is the host's: the desktop app's vault file, or this
 * page's memory on the web (`secretsBackend.ts`). The tab is the same over
 * either, and `note` says which.
 */
export default function SecretsTab({ getBackend, note, onSaved }: Props) {
  const {
    entries,
    supported,
    constrainable,
    grants,
    error,
    save: saveSecret,
    remove,
    revoke,
  } = useSecrets(getBackend);
  const [alias, setAlias] = useState("");
  const [value, setValue] = useState("");
  const [audience, setAudience] = useState("");
  // The alias whose audience is open for editing, and the text being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const save = async () => {
    const name = alias.trim();
    const hosts = parseAudience(audience);
    const saved = await saveSecret({
      alias: name,
      value,
      audience: hosts.length ? hosts : undefined,
    });
    if (saved) {
      setAlias("");
      setValue("");
      setAudience("");
      onSaved?.(name);
    }
  };

  const saveAudience = async (name: string) => {
    await saveSecret({ alias: name, audience: parseAudience(editText) });
    setEditing(null);
  };

  if (entries === null) {
    return <p className="hkp-set-hint">Loading…</p>;
  }
  if (!supported) {
    return (
      <SettingsNote>This build cannot store secrets.</SettingsNote>
    );
  }

  return (
    <SettingsStack>
      <SettingsSection
        label="Stored secrets"
        hint="Give a secret a name here, then refer to it from a board by that name instead of pasting the value in. A board written that way holds no credentials, so it stays safe to save, share, or hand to the AI refiner."
      >
        <SettingsList empty="Nothing stored yet.">
          {entries.map((entry) => (
            <SettingsRow
              key={entry.alias}
              icon={<KeyRound size={15} />}
              mono
              title={secretReference(entry.alias)}
              subtitle={
                editing === entry.alias ? undefined : (
                  <button
                    disabled={!constrainable}
                    onClick={() => {
                      setEditing(entry.alias);
                      setEditText(entry.audience.join(", "));
                    }}
                    title={constrainable ? "Edit the hosts it may be sent to" : undefined}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      maxWidth: "100%",
                      padding: 0,
                      border: "none",
                      background: "none",
                      font: "inherit",
                      color: entry.audience.length ? "inherit" : "var(--set-warn)",
                      cursor: constrainable ? "pointer" : "default",
                    }}
                  >
                    <Globe size={11} style={{ flex: "0 0 auto" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {entry.audience.length
                        ? entry.audience.join(", ")
                        : "any host — pinned to the first one it is sent to"}
                    </span>
                  </button>
                )
              }
              trailing={
                <RemoveButton
                  label={`Remove ${entry.alias}`}
                  onClick={() => void remove(entry.alias)}
                />
              }
            >
              {editing === entry.alias && (
                <div className="hkp-set-inline" style={{ padding: "0 12px 10px 56px" }}>
                  <SettingsInput
                    mono
                    value={editText}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void saveAudience(entry.alias);
                      }
                      if (e.key === "Escape") {
                        setEditing(null);
                      }
                    }}
                    placeholder="imap.gmail.com, *.example.com"
                  />
                  <SettingsButton onClick={() => setEditing(null)}>
                    Cancel
                  </SettingsButton>
                  <SettingsButton
                    variant="primary"
                    onClick={() => void saveAudience(entry.alias)}
                  >
                    Save
                  </SettingsButton>
                </div>
              )}
            </SettingsRow>
          ))}
        </SettingsList>
      </SettingsSection>

      <SettingsSection label="Add or replace">
        <SettingsCard>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="hkp-set-inline">
              <SettingsInput
                mono
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="name"
                style={{ flex: "0 0 34%" }}
              />
              <SettingsInput
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void save();
                  }
                }}
                type="password"
                placeholder="value"
                autoComplete="off"
              />
            </div>
            {constrainable && (
              <SettingsInput
                mono
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="hosts it may be sent to — blank to pin on first use"
              />
            )}
            <div className="hkp-set-inline" style={{ justifyContent: "space-between" }}>
              <span>
                {error && <span className="hkp-set-error">{error}</span>}
                {alias.trim() && !error && (
                  <span className="hkp-set-hint">
                    Refer to it as{" "}
                    <code className="hkp-set-mono">
                      {secretReference(alias.trim())}
                    </code>
                  </span>
                )}
              </span>
              <SettingsButton variant="primary" onClick={() => void save()}>
                <Plus size={14} />
                Save
              </SettingsButton>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {grants.length > 0 && (
        <SettingsSection
          label="Runtimes you allowed"
          hint="Boards allowed to hand a secret to a runtime without asking again. Forget one and the next board that tries will ask."
        >
          <SettingsList>
            {grants.map((grant) => (
              <SettingsRow
                key={grant.key}
                icon={<Server size={15} />}
                title={grant.boardName}
                subtitle={
                  <span className="hkp-set-mono">
                    {grant.origin} · {grant.aliases.join(", ")}
                  </span>
                }
                trailing={
                  <RemoveButton
                    label={`Forget ${grant.boardName}`}
                    onClick={() => void revoke(grant.key)}
                  />
                }
              />
            ))}
          </SettingsList>
        </SettingsSection>
      )}

      {note}
    </SettingsStack>
  );
}
