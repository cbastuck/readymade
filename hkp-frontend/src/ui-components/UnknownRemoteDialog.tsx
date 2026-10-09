import { useEffect, useState } from "react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  RemoteAnswer,
  UnknownRemote,
  registerRemotePrompt,
} from "hkp-frontend/src/core/remotePrompt";
import {
  EMBEDDED_REMOTE_NAME,
  REMOTE_URL_PREFIX,
  remoteNames,
  withAlias,
} from "hkp-frontend/src/runtime/board/remote";
import { RuntimeClass, isRuntimeRestClassType } from "hkp-frontend/src/types";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";

import { toServerBaseUrl } from "./connections/serverUrl";
import { useRemoteRuntimeEditing } from "./toolbar/useRemoteRuntimeEditing";

/** One name nobody is kept under, and the restore waiting to hear who it is. */
type Pending = {
  wanted: UnknownRemote;
  answer: (remote: RemoteAnswer) => void;
};

/**
 * Asks which runtime server a board means by a name this client keeps none
 * under, and keeps the answer.
 *
 * Two answers, both the person's: one of the servers they already keep, which
 * then answers to this name as well as its own, or the address of one they do
 * not keep yet, which is kept under the name. Either way the name resolves by
 * itself from then on, for this board and every other that says it. Dismissing
 * answers with nothing, and the board fails to open as it did before there was
 * anybody to ask — see `core/remotePrompt.ts`.
 */
export default function UnknownRemoteDialog() {
  const boardContext = useBoardContext();
  const { onAdd, onUpdate } = useRemoteRuntimeEditing();
  const [queue, setQueue] = useState<Pending[]>([]);
  const [address, setAddress] = useState("");

  useEffect(
    () =>
      registerRemotePrompt(
        (wanted) =>
          new Promise<RemoteAnswer>((resolve) => {
            setQueue((pending) => [...pending, { wanted, answer: resolve }]);
          }),
      ),
    [],
  );

  const current = queue[0];
  if (!current) {
    return null;
  }

  const settle = (remote: RemoteAnswer) => {
    current.answer(remote);
    setQueue((pending) => pending.slice(1));
    setAddress("");
  };

  const { name, runtimeName, kind } = current.wanted;

  // The servers that can take another name: the ones the person keeps. The
  // runtime a host embeds is the host's own, name and all.
  const kept = (boardContext?.availableRuntimeEngines ?? []).filter(
    (rt) =>
      isRuntimeRestClassType(rt.type) &&
      !!rt.url &&
      !rt.url.startsWith(REMOTE_URL_PREFIX),
  );

  const pickKept = (rt: RuntimeClass) => {
    const named = withAlias(rt, name);
    onUpdate(rt, named);
    settle(named);
  };

  const url = toServerBaseUrl(address);
  const addNew = () => {
    if (!url) {
      return;
    }
    const added: RuntimeClass = { type: "rest", name, url };
    onAdd(added);
    settle(added);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          settle(null);
        }
      }}
    >
      <DialogContent className="max-w-lg w-[92vw]">
        <DialogHeader>
          <DialogTitle>
            Which runtime server is “{name}”?
          </DialogTitle>
          <DialogDescription>
            The runtime <span className="font-mono">{runtimeName}</span> runs
            on the runtime server this board calls{" "}
            <span className="font-mono">{name}</span>
            {kind ? <> — an {kind}</> : null}. A board says a name instead of
            an address, because where a server runs is different for everyone
            who opens it, and you keep no server under this one yet.
            {name === EMBEDDED_REMOTE_NAME && (
              <>
                {" "}
                It is what a board calls the runtime the Readymade app embeds,
                and there is none here: open the board in the app, or say which
                hkp-rt of yours stands in for it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1 text-sm text-slate-700 leading-snug">
          {kept.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="font-medium text-slate-900">
                One of the servers you keep
              </div>
              <span>
                It answers to <span className="font-mono">{name}</span> as
                well from then on, and keeps the name it has.
              </span>
              <ul className="flex flex-col gap-1.5 pt-0.5">
                {kept.map((rt, idx) => (
                  <li key={`${rt.name}-${rt.url}-${idx}`}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => pickKept(rt)}
                      aria-label={`Use ${rt.name} as ${name}`}
                    >
                      <div className="font-medium text-slate-900">
                        {remoteNames(rt).join(", ")}
                      </div>
                      <div className="font-mono text-[0.78rem] text-slate-500 break-all">
                        {rt.url}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-slate-900">
              {kept.length > 0 ? "Or another one" : "Where it runs"}
            </div>
            <span>
              The address{kind ? ` your ${kind}` : " the server"} runs at. It is
              kept as <span className="font-mono">{name}</span>.
            </span>
            <div className="flex gap-2">
              <Input
                aria-label={`Address of ${name}`}
                style={{ fontSize: 16 }}
                placeholder="http://127.0.0.1:8080"
                value={address}
                onChange={(ev) => setAddress(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    addNew();
                  }
                }}
              />
              <Button size="sm" className="h-10" disabled={!url} onClick={addNew}>
                Keep and open
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => settle(null)}>
            Do not open the board
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
