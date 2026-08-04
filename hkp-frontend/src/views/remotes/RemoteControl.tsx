import { useContext } from "react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import Runtime from "hkp-frontend/src/components/Runtime";
import { ProcessContext, RuntimeClass } from "hkp-frontend/src/types";

type Props = {
  runtimeClass: RuntimeClass;
  /** Show only this runtime; every runtime on the server when absent. */
  runtimeId?: string;
};

/**
 * The runtimes of a remote server, rendered with their real service panels.
 *
 * The panels are live: each runtime's scope holds the server's own WebSocket,
 * so a service that reports through notifications — a Monitor, whose output is
 * no part of its state — says here what it says to the board that owns it.
 */
export default function RemoteControl({ runtimeClass, runtimeId }: Props) {
  const context = useContext(BoardCtx);
  const runtimes = (context?.runtimes || []).filter(
    (rt) => !runtimeId || rt.id === runtimeId,
  );

  // A result belongs to the board this runtime is part of, and that board's
  // next runtime is not here: this view watches one link of a chain, not the
  // chain. The server routes its own output as it always did.
  const onResult = async (
    _uuid: string | null,
    _result: unknown,
    _ctx?: ProcessContext | null,
  ) => {};

  const processRuntimeByName = async () => undefined;

  if (!context) {
    return null;
  }

  if (runtimes.length === 0) {
    return (
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9a9fae",
          fontSize: 13,
        }}
      >
        {runtimeId
          ? `No runtime "${runtimeId}" on this server any more.`
          : "This server is running no runtimes."}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div
        className="flex flex-col"
        style={{ padding: "var(--board-padding, 0px)" }}
      >
        {runtimes.map((rt) => (
          <Runtime
            key={`remote-runtime-${rt.id}`}
            boardContext={context}
            runtime={{ ...runtimeClass, ...rt }}
            initialState={{ wrapServices: false, minimized: false }}
            expanded={true}
            onResult={onResult}
            processRuntimeByName={processRuntimeByName}
          />
        ))}
      </div>
    </div>
  );
}
