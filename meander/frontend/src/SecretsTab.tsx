import { useEffect, useState } from "react";
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
import { readGrantKey } from "hkp-frontend/src/core/secretConsent";
import { allGrants } from "hkp-frontend/src/grants";

import { getBackend } from "./backend";

/** What a secret says about itself here: its name and where it may be sent. */
type Entry = { alias: string; audience: string[] };

/** One remembered answer to the consent prompt. */
type Grant = {
  key: string;
  boardName: string;
  runtimeId: string;
  origin: string;
  aliases: string[];
};

function heldGrants(): Grant[] {
  return Object.entries(allGrants())
    .map(([key, aliases]) => {
      const parts = readGrantKey(key);
      return parts ? { key, ...parts, aliases } : null;
    })
    .filter((grant): grant is Grant => grant !== null)
    .sort((a, b) => a.boardName.localeCompare(b.boardName));
}

/** An audience as typed: a comma or space separated list of hosts. */
function parseAudience(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

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
 * in this app and in every runtime the value is pushed to.
 */
export default function SecretsTab() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [constrainable, setConstrainable] = useState(true);
  const [alias, setAlias] = useState("");
  const [value, setValue] = useState("");
  const [audience, setAudience] = useState("");
  const [error, setError] = useState("");
  // The alias whose audience is open for editing, and the text being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);

  const refresh = async () => {
    const backend = await getBackend();
    if (!backend.listSecrets) {
      setSupported(false);
      setEntries([]);
      return;
    }
    const aliases = (await backend.listSecrets()).sort();
    // An older app build holds values only. Say so rather than offering an
    // edit that would fail: without a way to write one, every secret here is
    // unconstrained and nothing in this tab can change that.
    setConstrainable(!!backend.setSecretAudience);
    const audiences = (await backend.listSecretAudiences?.()) ?? {};
    setEntries(aliases.map((name) => ({ alias: name, audience: audiences[name] ?? [] })));
    setGrants(backend.revokeSecretGrant ? heldGrants() : []);
  };

  useEffect(() => {
    void refresh().catch(() => setSupported(false));
  }, []);

  const save = async () => {
    const name = alias.trim();
    setError("");
    // The alias is what a board writes into a reference, so it is limited to
    // what a reference can express rather than to what a name could be.
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
      setError("Use letters, digits, dots, hyphens and underscores only.");
      return;
    }
    if (!value) {
      setError("A secret with no value is the same as not having one.");
      return;
    }
    const backend = await getBackend();
    try {
      await backend.setSecret!(name, value);
      const hosts = parseAudience(audience);
      if (hosts.length) {
        await backend.setSecretAudience?.(name, hosts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setAlias("");
    setValue("");
    setAudience("");
    await refresh();
  };

  const saveAudience = async (name: string) => {
    const backend = await getBackend();
    try {
      await backend.setSecretAudience!(name, parseAudience(editText));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setEditing(null);
    await refresh();
  };

  const remove = async (name: string) => {
    const backend = await getBackend();
    await backend.deleteSecret!(name);
    await refresh();
  };

  const revoke = async (key: string) => {
    const backend = await getBackend();
    await backend.revokeSecretGrant!(key);
    await refresh();
  };

  if (entries === null) {
    return <p className="hkp-set-hint">Loading…</p>;
  }
  if (!supported) {
    return (
      <SettingsNote>Secrets are only stored inside the Readymade app.</SettingsNote>
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

      <SettingsNote tone="warn">
        Stored in ~/.hkp/vault.json, readable only by your user account. The
        file is not encrypted — anything that can run as you can read it. What
        you have allowed is in ~/.hkp/grants.json alongside it.
      </SettingsNote>
    </SettingsStack>
  );
}
