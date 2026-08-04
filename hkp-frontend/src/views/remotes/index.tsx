import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Server } from "lucide-react";

import BoardProvider, { EngineState } from "hkp-frontend/src/BoardContext";
import Toolbar from "hkp-frontend/src/components/Toolbar";
import { useAppContext } from "hkp-frontend/src/AppContext";
import { RuntimeClass, toCanonicalRuntimeClassType } from "hkp-frontend/src/types";
import { runtimeApis } from "../playground";
import { createObservedRuntimeApis } from "./observedRuntimeApi";
import RemoteControl from "./RemoteControl";

/**
 * A runtime running on a remote server, watched live.
 *
 * The board that owns it is elsewhere — possibly on another machine, possibly
 * a cloud board a coordinator provisioned; the server records no attribution,
 * so this view cannot say who owns it and never claims it. It attaches
 * (GET /runtimes plus the server's own WebSocket) and renders the runtime's
 * service panels with everything structural refused; see observedRuntimeApi.
 *
 * Reached from the start page's Remotes source, which drills
 * Remotes → server → runtime.
 */

type Props = {
  /** Remote servers as the host stores them (settings.json, localStorage, …). */
  remotes: RuntimeClass[];
  /** Which server, by the name the Remotes source shows. */
  remoteName?: string;
  /** Which runtime on it; all of the server's runtimes when absent. */
  runtimeId?: string;
  /** Top-left logo. Hosts pass a control that navigates home; without one the
   *  Toolbar renders a decorative mark that looks clickable but is not. */
  logoSlot?: ReactNode;
};

function Centred({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: "1 1 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        color: "#6b7080",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Which runtime is being watched, and that nothing structural about it can be
 * changed here. Goes in the toolbar's centre slot, where a view says where its
 * board is running — the same place a cloud board names its coordinator.
 */
function RemoteStatus({
  remote,
  runtimeId,
}: {
  remote: RuntimeClass;
  runtimeId?: string;
}) {
  const where = `${remote.name ? `${remote.name} · ` : ""}${remote.url ?? ""}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        title={`${runtimeId ?? "Every runtime"} on ${where}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          fontSize: 12.5,
          color: "var(--text-dim, #6b7280)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <Server size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {runtimeId ? `${runtimeId} on ` : ""}
          {where}
        </span>
      </span>
      <span
        title="This runtime belongs to whoever created it: its services can be configured, not added, removed or reordered."
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-dim, #6b7280)",
          background: "var(--bg-subtle, #f4f5f7)",
          borderRadius: 999,
          padding: "2px 8px",
        }}
      >
        Observing
      </span>
    </div>
  );
}

export default function Remotes({
  remotes,
  remoteName,
  runtimeId,
  logoSlot,
}: Props) {
  const { user } = useAppContext();

  const remote = useMemo(
    () =>
      remoteName
        ? remotes.find((rt) => (rt.name || rt.url) === remoteName)
        : undefined,
    [remotes, remoteName],
  );

  // Watching changes nothing on the server: attachRuntimes only reads (GET
  // /runtimes) and opens the socket the runtime already publishes. It must stay
  // that way — POST /runtimes with an existing id recreates the runtime on
  // hkp-rt, which would take down the board that owns it.
  const observedApis = useMemo(
    () => createObservedRuntimeApis(runtimeApis),
    [],
  );

  // The attach is owned by this effect, not cached: it opens a socket per
  // runtime, so whoever starts one has to be the one to close it. Each run
  // closes exactly the scopes it made — which is what makes a mount/unmount/
  // mount (React's development double-invoke, a quick navigation) end up with
  // live sockets rather than a board wired to ones already closed.
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const [attached, setAttached] = useState<{
    state: EngineState;
    attempt: number;
  }>();
  const [error, setError] = useState<Error>();
  const attemptRef = useRef(0);

  const closeScopes = (state: EngineState) => {
    for (const scope of Object.values(state.scopes)) {
      void scope.close?.();
    }
  };

  useEffect(() => {
    const current = remoteRef.current;
    setAttached(undefined);
    setError(undefined);
    if (!current) {
      return;
    }
    let cancelled = false;
    let opened: EngineState | undefined;
    const api =
      observedApis[current.type] ??
      observedApis[toCanonicalRuntimeClassType(current.type)];

    Promise.resolve(api?.attachRuntimes?.(current, user))
      .then((state) => {
        if (!state) {
          return;
        }
        opened = state;
        if (cancelled) {
          // Gone before it arrived: nothing will render these, so let them go.
          closeScopes(state);
          return;
        }
        setAttached({ state, attempt: ++attemptRef.current });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
      if (opened) {
        closeScopes(opened);
      }
    };
    // Identified by where it is and who is asking; the descriptor object itself
    // is rebuilt whenever the host's remotes list is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.url, remote?.type, user?.idToken, observedApis]);

  const state = attached?.state;
  const isLoading = !!remote && !state && !error;

  const shell = (children: ReactNode, statusSlot?: ReactNode) => (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: "var(--bg-app, #fafafa)" }}
    >
      <Toolbar logoSlot={logoSlot} statusSlot={statusSlot} />
      {children}
    </div>
  );

  if (!remoteName) {
    return shell(<Centred>Pick a runtime in the start page's Remotes.</Centred>);
  }
  if (!remote) {
    return shell(
      <Centred>
        No remote server named &ldquo;{remoteName}&rdquo; is configured here.
      </Centred>,
    );
  }
  if (error) {
    return shell(
      <Centred>
        {error instanceof Error
          ? error.message
          : `Could not reach ${remote.url}`}
      </Centred>,
    );
  }
  // The provider reads its engine state when it mounts, so it may not mount
  // before there is one to give it.
  if (isLoading || !state) {
    return shell(<Centred>Reaching {remote.url}…</Centred>);
  }

  return (
    <BoardProvider
      // A provider per attach: it reads the engine state once, when it mounts,
      // and that state is a set of live scopes. A new attach is a new provider.
      key={attached.attempt}
      user={user}
      initialState={state}
      runtimeApis={observedApis}
      onUnmountRuntime={() => {
        // Nothing: the runtime is not ours to delete (which the default
        // teardown would do), and its socket is not ours to close either — the
        // attach above opened it and closes it, on the one unmount that is
        // real. A provider that closed it here would leave the board wired to a
        // dead socket every time React unmounts and remounts it.
      }}
    >
      {shell(
        <RemoteControl runtimeClass={remote} runtimeId={runtimeId} />,
        <RemoteStatus remote={remote} runtimeId={runtimeId} />,
      )}
    </BoardProvider>
  );
}
