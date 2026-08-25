import { useEffect, useState } from "react";
import { KeyRound, Plus, X } from "lucide-react";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { secretReference } from "hkp-frontend/src/core/secrets";

import { getBackend } from "./backend";

/**
 * The values behind the aliases a board refers to.
 *
 * A board says `{{secret.gmail}}` and never what that is; this is where the
 * what lives. Values are write-only here in the same way a service treats a
 * password: they can be set and replaced, never read back — the field is for
 * putting something in, and nothing in a settings dialog needs to show a
 * credential to the person who typed it.
 */
export default function SecretsTab() {
  const [aliases, setAliases] = useState<string[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [alias, setAlias] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const backend = await getBackend();
    if (!backend.listSecrets) {
      setSupported(false);
      setAliases([]);
      return;
    }
    setAliases((await backend.listSecrets()).sort());
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setAlias("");
    setValue("");
    await refresh();
  };

  const remove = async (name: string) => {
    const backend = await getBackend();
    await backend.deleteSecret!(name);
    await refresh();
  };

  if (aliases === null) {
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

      {aliases.length === 0 && (
        <span className="text-[0.8rem] italic text-slate-400">
          Nothing stored yet.
        </span>
      )}
      {aliases.map((name) => (
        <div
          key={name}
          className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <KeyRound size={14} className="shrink-0 text-slate-400" />
            <code className="truncate font-mono text-slate-800">
              {secretReference(name)}
            </code>
          </div>
          <button
            onClick={() => void remove(name)}
            aria-label={`Remove ${name}`}
            className="shrink-0 text-slate-400 hover:text-red-600"
          >
            <X size={15} />
          </button>
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
        {error && <span className="text-[0.78rem] text-red-600">{error}</span>}
        {alias.trim() && !error && (
          <span className="text-[0.78rem] text-slate-500">
            Refer to it as{" "}
            <code className="font-mono">{secretReference(alias.trim())}</code>
          </span>
        )}
      </div>

      <span className="text-[0.78rem] text-amber-700 leading-snug">
        ⚠️ Stored in ~/.hkp/vault.json, readable only by your user account. The
        file is not encrypted — anything that can run as you can read it.
      </span>
    </div>
  );
}
