import { useState } from "react";

type Props = {
  onLogin: () => Promise<void>;
};

const TERMS_URL = "https://readymadeit.com/terms";

/**
 * Plain-language restatement of the Acceptable Use section of the Terms. Shown
 * here because this is where an account first becomes relevant. It is a
 * summary, not the agreement — the note below the list says so, and the link
 * goes to the text that actually applies.
 */
const ACCEPTABLE_USE = [
  "Keep it legal, and respect other people's rights.",
  "No spam or bulk messaging through connected services.",
  "No malware, and nothing that harasses, threatens, or exposes people.",
  "Don't impersonate other people or organisations.",
  "Don't attack the service or reach for accounts and data that aren't yours.",
  "Your account is yours — keep your credentials to yourself.",
];

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
      <div className="max-w-sm text-left mt-2">
        <div className="text-xs font-medium text-neutral-500 mb-1">
          A few things we ask of everyone here
        </div>
        <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-neutral-500">
          {ACCEPTABLE_USE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="text-xs text-neutral-400 mt-2">
          This is the short version. The{" "}
          <a
            className="underline hover:opacity-70"
            href={TERMS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Terms of Use
          </a>{" "}
          are what apply. Found a security problem? Good-faith research is
          welcome — tell us at christoph@bstck.berlin.
        </div>
      </div>
    </div>
  );
}
