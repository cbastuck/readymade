import { useState } from "react";

type Props = {
  onLogin: () => Promise<void>;
};

/**
 * Full-view gate shown when no user is signed in. Cloud boards require an
 * authenticated session (coordinators authorize every request), so the rest of
 * the view is not rendered until login succeeds.
 */
export default function CloudLoginGate({ onLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4 text-center px-6">
      <div className="text-neutral-500 text-base">
        Sign in to use cloud boards
      </div>
      <button
        className="hkp-svc-btn px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 cursor-pointer transition-all hover:bg-slate-50 hover:border-slate-400 disabled:opacity-60 disabled:cursor-default"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error && (
        <div className="text-xs text-red-500 break-all max-w-sm">{error}</div>
      )}
    </div>
  );
}
