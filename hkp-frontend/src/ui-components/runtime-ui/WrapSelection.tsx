/**
 * Acting on the services picked in a runtime: wrapping them in a sub-service,
 * or making a block of them. The bar shown above a runtime's services while
 * some are picked, and the same two actions for a service's own menu.
 */

import { useState } from "react";
import { Boxes, Layers, X } from "lucide-react";
import { toast } from "sonner";

import CustomDialog from "../CustomDialog";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import {
  BoardContextState,
  useBoardContext,
} from "hkp-frontend/src/BoardContext";
import { WrapRefused } from "hkp-frontend/src/core/wrapActions";
import { nameForRun } from "hkp-frontend/src/runtime/board/wrap";
import { useSelection } from "hkp-frontend/src/selection/SelectionContext";

function refused(title: string, err: unknown) {
  const reasons =
    err instanceof WrapRefused
      ? err.reasons
      : [(err as Error)?.message ?? String(err)];
  toast.error(title, { description: reasons.join("\n") });
}

/**
 * Wraps the run `uuids` of a runtime in a sub-service, saying why when it
 * cannot be. Answers whether it was done.
 */
export function wrapRun(
  boardContext: BoardContextState,
  runtimeId: string,
  uuids: string[],
): Promise<boolean> {
  return boardContext
    .wrapServices(runtimeId, uuids)
    .then(() => true)
    .catch((err) => {
      refused("Could not wrap the services", err);
      return false;
    });
}

/**
 * Wraps the run `uuids` of a runtime and makes a block named `name` of it, in
 * one step, saying how it went. `addedFrom` names where the block is added
 * again, in the host's terms. Answers whether it was done.
 */
export function makeBlockOfRun(
  boardContext: BoardContextState,
  runtimeId: string,
  uuids: string[],
  name: string,
  addedFrom = "the Building Blocks sidebar",
): Promise<boolean> {
  return boardContext
    .wrapServices(runtimeId, uuids, { asBlock: true, name })
    .then(({ block }) => {
      toast.success(`"${block?.name ?? name}" is now a block of this board`, {
        description: `Add it again from ${addedFrom}.`,
      });
      return true;
    })
    .catch((err) => {
      refused("Could not make a block", err);
      return false;
    });
}

/** What a block made of these services is called until somebody says otherwise. */
export function blockNameForRun(
  boardContext: BoardContextState | null,
  runtimeId: string,
  uuids: string[],
): string {
  return nameForRun(
    (boardContext?.services[runtimeId] ?? [])
      .filter((svc) => uuids.includes(svc.uuid))
      .map((svc) => svc.serviceName || svc.serviceId),
  );
}

/** What the two actions need, and the dialog that names a block before it is made. */
export function useWrapActions() {
  const boardContext = useBoardContext();
  const selection = useSelection();
  const [naming, setNaming] = useState<{
    runtimeId: string;
    uuids: string[];
    name: string;
  } | null>(null);

  const wrap = (runtimeId: string, uuids: string[]) => {
    if (boardContext) {
      void wrapRun(boardContext, runtimeId, uuids).then(
        (done) => done && selection?.selectServices?.(null),
      );
    }
  };

  const makeBlock = (runtimeId: string, uuids: string[], name: string) => {
    if (boardContext) {
      void makeBlockOfRun(boardContext, runtimeId, uuids, name).then((done) => {
        if (done) {
          selection?.selectServices?.(null);
          setNaming(null);
        }
      });
    }
  };

  const askToMakeBlock = (runtimeId: string, uuids: string[]) =>
    setNaming({
      runtimeId,
      uuids,
      name: blockNameForRun(boardContext, runtimeId, uuids),
    });

  const dialog = naming && (
    <CustomDialog
      title="Make a block"
      description={`The ${naming.uuids.length === 1 ? "service" : `${naming.uuids.length} services`} become one sub-service, and that sub-service the first use of a block of this board.`}
      isOpen
      onOpenChange={(open) => !open && setNaming(null)}
      className="sm:max-w-[460px] h-auto"
    >
      <div style={{ display: "flex", gap: 6 }}>
        <Input
          autoFocus
          aria-label="Block name"
          value={naming.name}
          onChange={(e) => setNaming({ ...naming, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && naming.name.trim()) {
              makeBlock(naming.runtimeId, naming.uuids, naming.name.trim());
            }
          }}
          style={{ fontSize: 16, height: 32 }}
        />
        <Button
          className="hkp-svc-btn"
          variant="outline"
          disabled={!naming.name.trim()}
          onClick={() =>
            makeBlock(naming.runtimeId, naming.uuids, naming.name.trim())
          }
        >
          Make block
        </Button>
      </div>
    </CustomDialog>
  );

  return { wrap, askToMakeBlock, dialog };
}

/** Shown above a runtime's services while some of them are picked. */
export function SelectionBar({
  runtimeId,
  uuids,
}: {
  runtimeId: string;
  uuids: string[];
}) {
  const selection = useSelection();
  const { wrap, askToMakeBlock, dialog } = useWrapActions();
  const count = uuids.length;
  const button: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    border: "none",
    background: "transparent",
    color: "var(--hkp-accent, #0abcfb)",
    cursor: "pointer",
    padding: "2px 4px",
    fontSize: 13,
  };
  return (
    <div
      data-testid="service-selection-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 8px",
        marginRight: 8,
        fontSize: 13,
        cursor: "default",
        whiteSpace: "nowrap",
        color: "var(--text-mid)",
        border: "1px solid var(--border-mid, #d8d2ca)",
        borderRadius: 8,
        width: "fit-content",
      }}
    >
      <span>
        {count} {count === 1 ? "service" : "services"} selected
      </span>
      <button
        type="button"
        style={button}
        onClick={() => wrap(runtimeId, uuids)}
      >
        <Layers size={14} strokeWidth={1.5} />
        Wrap in SubService
      </button>
      <button
        type="button"
        style={button}
        onClick={() => askToMakeBlock(runtimeId, uuids)}
      >
        <Boxes size={14} strokeWidth={1.5} />
        Make block
      </button>
      <button
        type="button"
        title="Clear the selection (Esc)"
        aria-label="Clear the selection"
        style={{ ...button, color: "var(--text-mid)" }}
        onClick={() => selection?.selectServices?.(null)}
      >
        <X size={14} strokeWidth={1.5} />
      </button>
      {dialog}
    </div>
  );
}
