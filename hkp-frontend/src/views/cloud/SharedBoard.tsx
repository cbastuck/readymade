import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import BoardProvider, {
  BoardProviderHandle,
  useBoardContext,
} from "../../BoardContext";
import { BoardDescriptor, RuntimeClass, User } from "../../types";
import { createBoardCoordinator } from "../../core/coordinator";
import FacadeRenderer from "../../facade/FacadeRenderer";
import { FacadeIdentityProvider } from "../../facade/FacadeIdentity";
import { FacadeDescriptor } from "../../facade/types";
import MobileFacadeView from "../playground/mobile/MobileFacadeView";
import { runtimeApis } from "../playground";
import {
  CoordinatorBridgeAccess,
  createBridgeRuntimeApi,
} from "./bridgeRuntimeApi";
import { CoordinatorSnapshotStore } from "./coordinatorSnapshot";
import { BridgeRefusal, useCoordinatorBridge } from "./useCoordinatorBridge";
import { SharedBoardLink, bridgeUrlFor } from "./sharedLink";

/**
 * A board somebody shared, as its member sees it.
 *
 * There is no board underneath to show. What the coordinator sends a member is
 * a projection — the facade, and of the board only the services the facade
 * names — so this renders a facade and nothing else: no runtimes, no service
 * panels, no editor. Everything the facade does goes over the bridge to the
 * board's coordinator, which runs it as the person it verified.
 */

type Props = {
  shared: SharedBoardLink;
  user: User;
  /** Stacked panels for a phone rather than the desktop's side-by-side ones. */
  compact?: boolean;
  /** Shown above the facade: where the board is, and the way back. */
  header?: ReactNode;
};

const NO_ENGINES: RuntimeClass[] = [];

function notAttached(): Promise<never> {
  return Promise.reject(new Error("Not attached to a coordinator"));
}

const REFUSALS: Record<BridgeRefusal, { title: string; body: string }> = {
  removed: {
    title: "This board is no longer shared with you",
    body: "Its owner took you off the list. Ask them if that was not meant.",
  },
  "not-found": {
    title: "This board is not shared with you",
    body:
      "Either it is not there any more, or its member list does not name the " +
      "address you are signed in with. Its owner can tell you which.",
  },
  "too-many": {
    title: "This board is open in too many places",
    body:
      "You have it open in as many windows and devices as one member may. " +
      "Close it in one of them, then open it here again.",
  },
};

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div
      role="status"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: 24,
        textAlign: "center",
        color: "var(--text-dim, #6b7280)",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      {body && <div style={{ fontSize: 13, maxWidth: 420 }}>{body}</div>}
    </div>
  );
}

function SharedBoardInner({
  shared,
  user,
  compact,
  bridgeAccess,
  onHydrate,
}: Props & {
  bridgeAccess: CoordinatorBridgeAccess;
  onHydrate: (config: BoardDescriptor) => void;
}) {
  const boardContext = useBoardContext();
  const { configureRemoteService, processRemoteService, refused } =
    useCoordinatorBridge(
      bridgeUrlFor(shared.coordinatorUrl),
      shared.owner,
      shared.boardName,
      boardContext,
      user.idToken,
      bridgeAccess.snapshot,
      true,
    );
  bridgeAccess.configureRemoteService = configureRemoteService;
  bridgeAccess.processRemoteService = processRemoteService;

  const subscribe = (onChange: () => void) =>
    bridgeAccess.snapshot.subscribe(onChange);
  const config = useSyncExternalStore(subscribe, () =>
    bridgeAccess.snapshot.getConfig(),
  ) as BoardDescriptor | null;
  const status = useSyncExternalStore(subscribe, () =>
    bridgeAccess.snapshot.getStatus(),
  );
  const you = useSyncExternalStore(subscribe, () =>
    bridgeAccess.snapshot.getYou(),
  );

  // Hydrated once per attachment, from what the coordinator said the board is.
  // A snapshot arriving again — a rename, a runtime coming back — refreshes
  // state through the store and must not rebuild the board under a facade
  // somebody is in the middle of using.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!config) {
      hydrated.current = false;
      return;
    }
    if (!hydrated.current) {
      hydrated.current = true;
      onHydrate(config);
    }
  }, [config, onHydrate]);

  if (refused) {
    return <Message {...REFUSALS[refused]} />;
  }
  if (!config || !boardContext) {
    return <Message title="Opening…" />;
  }
  const facade = config.facade as FacadeDescriptor | undefined;
  if (!facade?.panels?.length) {
    return (
      <Message
        title="Nothing to show"
        body="This board has no facade, and a facade is what a shared board is used through."
      />
    );
  }

  return (
    <FacadeIdentityProvider identity={you}>
      {status === "stopped" && (
        <div
          role="status"
          style={{
            padding: "6px 12px",
            fontSize: 12.5,
            color: "var(--text-dim, #6b7280)",
            borderBottom: "1px solid var(--border, #e5e7eb)",
          }}
        >
          Its owner has stopped this board, so nothing on it will answer.
        </div>
      )}
      {compact ? (
        <MobileFacadeView
          facade={facade}
          boardContext={boardContext}
          boardName={shared.boardName}
        />
      ) : (
        <FacadeRenderer
          facade={facade}
          boardContext={boardContext}
          boardName={shared.boardName}
          runtimeContent={null}
        />
      )}
    </FacadeIdentityProvider>
  );
}

export default function SharedBoard(props: Props) {
  const { shared, user, header } = props;
  const boardProviderRef = useRef<BoardProviderHandle>(null);

  // One store and one access object per board opened: the runtime api and the
  // board coordinator below are built around them and read through.
  const bridgeAccess = useMemo<CoordinatorBridgeAccess>(
    () => ({
      snapshot: new CoordinatorSnapshotStore(),
      configureRemoteService: notAttached,
      processRemoteService: notAttached,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shared.coordinatorUrl, shared.owner, shared.boardName],
  );
  const attachedRuntimeApis = useMemo(
    () => ({
      ...runtimeApis,
      rest: createBridgeRuntimeApi(bridgeAccess),
      realtime: createBridgeRuntimeApi(bridgeAccess),
    }),
    [bridgeAccess],
  );
  const boardCoordinator = useMemo(
    () => createBoardCoordinator(() => bridgeAccess.snapshot.asCoordinatorState()),
    [bridgeAccess],
  );

  return (
    <BoardProvider
      ref={boardProviderRef}
      user={user}
      coordinator={boardCoordinator}
      runtimeApis={attachedRuntimeApis}
      availableRuntimeEngines={NO_ENGINES}
      onRemoveRuntime={async () => {}}
      onUnmountRuntime={(_runtime, scope) => {
        void scope.close?.();
      }}
    >
      <div
        className="w-full h-full flex flex-col"
        style={{ minHeight: 0, background: "hsl(var(--background, 0 0% 100%))" }}
      >
        {header}
        <SharedBoardInner
          {...props}
          bridgeAccess={bridgeAccess}
          onHydrate={(config) => boardProviderRef.current?.setBoardState(config)}
        />
      </div>
    </BoardProvider>
  );
}
