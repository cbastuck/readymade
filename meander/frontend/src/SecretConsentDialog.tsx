import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

import {
  ConsentDecision,
  SecretRelease,
  inProcessRuntime,
  setSecretConsent,
} from "hkp-frontend/src/core/secretConsent";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

/** One question, and the promise the release is waiting on. */
type Pending = {
  request: SecretRelease;
  answer: (decision: ConsentDecision) => void;
};

/**
 * The address of the runtime this app embeds, as this app knows it.
 *
 * `inProcessRuntime` knows what an in-process address looks like; the port it
 * is bound to is the one thing only the host can say.
 */
function isEmbeddedRuntime(url: string): boolean {
  return inProcessRuntime(url, (window as any).__MEANDER_CONFIG__?.runtimePort);
}

/**
 * Asks before a board hands credentials to a runtime.
 *
 * The board chose the services, the secrets they name and the server they run
 * on, and a board is not necessarily one you wrote. This is where that choice
 * is put to the person whose vault it is, once per board, runtime and address —
 * see `hkp-frontend/src/core/secretConsent.ts` for what the answer is keyed on
 * and why each part of the key is there.
 */
export default function SecretConsentDialog() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    setSecretConsent({
      isInProcess: isEmbeddedRuntime,
      prompt: (request) =>
        new Promise<ConsentDecision>((resolve) => {
          setQueue((pending) => [...pending, { request, answer: resolve }]);
        }),
    });
    return () => setSecretConsent({ prompt: null });
  }, []);

  const current = queue[0];
  // Each question gets the default afresh: leaving "don't ask again" ticked
  // from a previous answer would carry an intent that was never restated.
  const settle = (decision: ConsentDecision) => {
    current?.answer(decision);
    setQueue((pending) => pending.slice(1));
    setRemember(true);
  };

  if (!current) {
    return null;
  }

  const { boardName, runtimeId, runtimeName, url, aliases } = current.request;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Dismissing is a refusal. A board that is denied its credentials still
        // runs; the services naming them report what is missing.
        if (!open) {
          settle({ allowed: [], remember: false });
        }
      }}
    >
      <DialogContent className="max-w-md w-[90vw]">
        <DialogHeader>
          <DialogTitle>Send secrets to this runtime?</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{boardName || "This board"}</span> wants
            to give runtime{" "}
            <span className="font-mono">{runtimeName || runtimeId}</span> at{" "}
            <span className="font-mono break-all">{url}</span> the values behind:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-1 text-sm">
          {aliases.map((alias) => (
            <div key={alias} className="flex items-center gap-2">
              <KeyRound size={14} className="shrink-0 text-slate-400" />
              <code className="font-mono text-slate-800">{alias}</code>
            </div>
          ))}
        </div>

        <span className="text-[0.78rem] text-slate-500 leading-snug">
          The server can use these for as long as it holds them. Only allow this
          for a board and a server you trust.
        </span>

        <label className="flex items-center gap-2 text-[0.8rem] text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Don&rsquo;t ask again for this board and server
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => settle({ allowed: [], remember: false })}
          >
            Deny
          </Button>
          <Button size="sm" onClick={() => settle({ allowed: aliases, remember })}>
            Allow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
