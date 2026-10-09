import { useEffect, useState } from "react";

import {
  ReachDecision,
  UnreachableServer,
  isAllowedUnasked,
  isBlockedAsMixedContent,
  reachesServer,
  registerReachPrompt,
} from "hkp-frontend/src/core/runtimeReach";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

/** One server that did not answer, and the request waiting to hear what to do. */
type Pending = {
  server: UnreachableServer;
  answer: (decision: ReachDecision) => void;
};

function Code({ children }: { children: string }) {
  return (
    <code className="font-mono text-[0.8rem] text-slate-800 break-all select-all">
      {children}
    </code>
  );
}

/**
 * Says what to do when a board's runtime server gives this page no answer,
 * and waits while it is done.
 *
 * A server that is not running and one that does not allow this page look the
 * same from here — the second on purpose, see `core/runtimeReach.ts` — so both
 * are said, each with its remedy. Both remedies are at the server's end, which
 * is why this has one thing to press: check again. The board carries on by
 * itself the moment the server answers; nothing has to be reloaded.
 */
export default function RuntimeUnreachableDialog() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(
    () =>
      registerReachPrompt(
        (server) =>
          new Promise<ReachDecision>((resolve) => {
            setQueue((pending) => [...pending, { server, answer: resolve }]);
          }),
      ),
    [],
  );

  const current = queue[0];
  if (!current) {
    return null;
  }

  const settle = (decision: ReachDecision) => {
    current.answer(decision);
    setQueue((pending) => pending.slice(1));
    setLastChecked(null);
  };

  const checkAgain = async () => {
    setChecking(true);
    const reached = await reachesServer(current.server.url);
    setChecking(false);
    if (reached) {
      settle("retry");
      return;
    }
    setLastChecked(new Date().toLocaleTimeString());
  };

  const { url, runtimeName } = current.server;
  const origin = window.location.origin;
  const allowedUnasked = isAllowedUnasked(origin);
  const mixedContent = isBlockedAsMixedContent(window.location.href, url);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Dismissing lets the board load without this runtime, which then
        // reports the failure where it always did.
        if (!open) {
          settle("give-up");
        }
      }}
    >
      <DialogContent className="max-w-lg w-[92vw]">
        <DialogHeader>
          <DialogTitle>No answer from the runtime server</DialogTitle>
          <DialogDescription>
            The runtime <span className="font-mono">{runtimeName}</span> runs
            on <span className="font-mono break-all">{url}</span>, and that
            server gave this page no answer. Either it is not running, or it is
            running and does not allow pages from{" "}
            <span className="font-mono break-all">{origin}</span> — from a web
            page the two look the same.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1 text-sm text-slate-700 leading-snug">
          <div>
            <div className="font-medium text-slate-900">
              If it is not running
            </div>
            Start it, then check again.
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-slate-900">
              If it is running
            </div>
            {allowedUnasked ? (
              <span>
                A runtime server allows pages from this address unless it was
                started with its own list. If it was, add this page to it:
              </span>
            ) : (
              <span>
                A runtime server allows the Readymade apps and pages served
                from its own machine. Any other site has to be allowed on the
                machine the server runs on:
              </span>
            )}
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                In the Readymade app: Settings → Access → Allowed websites,
                add <Code>{origin}</Code>. It applies immediately.
              </li>
              <li>
                For hkp-node, hkp-python or hkp-rt started from a command
                line: start it with <Code>{`ALLOWED_ORIGINS=${origin}`}</Code>
              </li>
            </ul>
          </div>

          {mixedContent && (
            <div>
              <div className="font-medium text-slate-900">
                Or the browser is blocking it
              </div>
              This page was loaded over https and the server is addressed over
              http on another machine. Browsers refuse that whatever the server
              allows; the server needs an https address.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[0.78rem] text-slate-500" role="status">
            {checking
              ? "Checking…"
              : lastChecked
                ? `Still no answer (checked ${lastChecked}).`
                : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => settle("give-up")}
            >
              Continue without it
            </Button>
            <Button size="sm" disabled={checking} onClick={() => void checkAgain()}>
              Check again
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
