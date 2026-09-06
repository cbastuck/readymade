import { useEffect, useState } from "react";
import { Globe, KeyRound, Plus, Server, X } from "lucide-react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
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
    return <div className="pt-2 text-sm text-slate-500">Loading…</div>;
  }
  if (!supported) {
    return (
      <div className="pt-2 text-sm text-slate-500">
        Secrets are only stored inside the Readymade app.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2 text-sm">
      <span className="text-[0.8rem] text-slate-500 leading-snug">
        Give a secret a name here, then refer to it from a board by that name
        instead of pasting the value in. A board written that way holds no
        credentials, so it stays safe to save, share, or hand to the AI refiner.
      </span>

      {entries.length === 0 && (
        <span className="text-[0.8rem] italic text-slate-400">
          Nothing stored yet.
        </span>
      )}
      {entries.map((entry) => (
        <div
          key={entry.alias}
          className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <KeyRound size={14} className="shrink-0 text-slate-400" />
              <code className="truncate font-mono text-slate-800">
                {secretReference(entry.alias)}
              </code>
            </div>
            <button
              onClick={() => void remove(entry.alias)}
              aria-label={`Remove ${entry.alias}`}
              className="shrink-0 text-slate-400 hover:text-red-600"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2 pl-[22px] text-[0.78rem]">
            <Globe size={12} className="shrink-0 text-slate-400" />
            {editing === entry.alias ? (
              <>
                <input
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
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1 font-mono outline-none focus:border-slate-400"
                  style={{ fontSize: 16 }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void saveAudience(entry.alias)}
                >
                  Save
                </Button>
              </>
            ) : (
              <button
                disabled={!constrainable}
                onClick={() => {
                  setEditing(entry.alias);
                  setEditText(entry.audience.join(", "));
                }}
                className="min-w-0 flex-1 truncate text-left font-mono text-slate-600 hover:text-slate-900 disabled:cursor-default disabled:hover:text-slate-600"
              >
                {entry.audience.length ? (
                  entry.audience.join(", ")
                ) : (
                  <span className="font-sans italic text-amber-700">
                    any host — pinned to the first one it is sent to
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
        <span className="uppercase tracking-[0.12em] text-muted-foreground text-[0.68rem] font-semibold">
          Add or replace
        </span>
        <div className="flex items-center gap-2">
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="name"
            className="w-1/3 rounded-md border border-slate-200 px-3 py-2 font-mono outline-none focus:border-slate-400"
            style={{ fontSize: 16 }}
          />
          <input
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
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            style={{ fontSize: 16 }}
          />
          <Button variant="outline" size="sm" onClick={() => void save()} className="gap-1">
            <Plus size={14} />
            Save
          </Button>
        </div>
        {constrainable && (
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="hosts it may be sent to — blank to pin on first use"
            className="rounded-md border border-slate-200 px-3 py-2 font-mono outline-none focus:border-slate-400"
            style={{ fontSize: 16 }}
          />
        )}
        {error && <span className="text-[0.78rem] text-red-600">{error}</span>}
        {alias.trim() && !error && (
          <span className="text-[0.78rem] text-slate-500">
            Refer to it as{" "}
            <code className="font-mono">{secretReference(alias.trim())}</code>
          </span>
        )}
      </div>

      {grants.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
          <span className="uppercase tracking-[0.12em] text-muted-foreground text-[0.68rem] font-semibold">
            Runtimes you allowed
          </span>
          <span className="text-[0.78rem] text-slate-500 leading-snug">
            Boards allowed to hand a secret to a runtime without asking again.
            Forget one and the next board that tries will ask.
          </span>
          {grants.map((grant) => (
            <div
              key={grant.key}
              className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex min-w-0 items-start gap-2">
                <Server size={14} className="mt-[3px] shrink-0 text-slate-400" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-slate-800">
                    {grant.boardName}
                  </span>
                  <span className="truncate font-mono text-[0.72rem] text-slate-500">
                    {grant.origin}
                  </span>
                  <span className="truncate font-mono text-[0.72rem] text-slate-600">
                    {grant.aliases.join(", ")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => void revoke(grant.key)}
                aria-label={`Forget ${grant.boardName}`}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <span className="text-[0.78rem] text-amber-700 leading-snug">
        ⚠️ Stored in ~/.hkp/vault.json, readable only by your user account. The
        file is not encrypted — anything that can run as you can read it. What
        you have allowed is in ~/.hkp/grants.json alongside it.
      </span>
    </div>
  );
}
