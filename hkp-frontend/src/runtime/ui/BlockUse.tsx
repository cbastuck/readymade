import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Boxes, Check, Maximize2, Pencil, Trash2, Unlink, X } from "lucide-react";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { useIsMobileHost } from "hkp-frontend/src/MobileHostContext";
import {
  BlockDefinition,
  PlacedBlock,
  blockUseAt,
  outermostUses,
} from "../board/blocks";
import {
  useInlineHops,
  useLevelDepth,
  useNestedNavigation,
} from "./NestedNavigation";

/**
 * How a use of a block looks on the running board, and how everything inside
 * one is kept out of reach.
 *
 * **A use is frozen while the board runs** (see `runtime/board/blocks`): its
 * inside belongs to its definition, and saving writes the use back as it was
 * written. So the inside is locked, not merely styled — an edit made there
 * would be thrown away on save, which is the one outcome worse than not being
 * able to make it. What a use does take is drawn in its place: a bar with its
 * params, and detaching it into an ordinary copy. The panel itself is only
 * shown once the use is edited or detached, or when a level is opened on it.
 *
 * The lock is `inert`, which takes a subtree out of reach without stopping
 * anything in it — the same way NestedNavigation parks the levels behind the
 * one in front. A level opened from inside a use is portalled elsewhere in the
 * document, out from under that attribute, so the lock also travels as
 * context: whatever is rendered inside a use locks itself, wherever it lands.
 *
 * A panel's frame may take the lock over (`useFrameBlockLock`): it then keeps
 * its own controls out of reach and still offers what only reads — the
 * configuration, the documentation. A panel whose frame does not stays locked
 * whole. The frame may hand it on once more, to the panel drawn in its body
 * (`usePanelBlockLock`), which then keeps its own controls out of reach and
 * can still offer what only reads — a view of the details, say.
 */

/**
 * What an arrow press moves a number by: the precision its default is written
 * in — a volume of 0.8 steps by tenths, a count of 4 by ones.
 */
function stepOf(fallback: number): number {
  const decimals = (String(fallback).split(".")[1] ?? "").length;
  return decimals ? 10 ** -decimals : 1;
}

/** How long a number rests before it is taken — long enough for a run of arrow clicks. */
const NUMBER_SETTLE_MS = 400;

const BlockLockContext = createContext(false);

/**
 * The address of the service whose panel this is drawn in, as the board
 * dials it: its uuid at the top of a runtime, a dotted path through the
 * services containing it below. Carried as context rather than read off the
 * instance, because a browser panel is handed the live nested instance, which
 * knows only its own id — and a Switch's cases add no step to the path.
 */
const ServiceAddressContext = createContext<string | null>(null);

/**
 * The address of the service whose panel this is drawn in — for a pipeline
 * drawn inside that panel, the service it belongs to.
 */
export function useServiceAddress(): string | null {
  return useContext(ServiceAddressContext);
}

/**
 * The runtime holding the service whose panel this is drawn in. An address is
 * unique only within its runtime, so the two travel together: a pipeline drawn
 * inside a panel is on the runtime of the service it belongs to.
 */
const ServiceRuntimeContext = createContext<string | undefined>(undefined);

export function useServiceRuntimeId(): string | undefined {
  return useContext(ServiceRuntimeContext);
}

/** Whether this is being drawn inside a use of a block. */
export function useInsideBlockUse(): boolean {
  return useContext(BlockLockContext);
}

/**
 * Hands the lock of the use a panel is drawn in to that panel's frame. Returns
 * a release. Every frame that takes it locks itself, so a frame nested in
 * another one taking it as well opens nothing.
 */
const LockHandOverContext = createContext<(() => () => void) | null>(null);

/**
 * For a service's frame: takes over the lock of the use it is drawn in, and
 * says whether it is locked. While it is, the frame is what keeps the panel
 * out of reach, so it must lock everything in it that writes. `enabled` false
 * leaves the lock where it is — for a frame that draws nothing of its own.
 */
export function useFrameBlockLock(enabled = true): boolean {
  const locked = useInsideBlockUse();
  const handOver = useContext(LockHandOverContext);
  // Before paint: the frame is drawn locked from the start, so the panel
  // need not stay out of reach behind it for a frame.
  useLayoutEffect(
    () => (enabled && handOver ? handOver() : undefined),
    [enabled, handOver],
  );
  return locked;
}

/**
 * Counts who has taken a lock over. The lock stays where it is while nobody
 * has; the answer's second half takes it and returns a release.
 */
export function useLockHandOver(): [number, () => () => void] {
  const [taken, setTaken] = useState(0);
  const handOver = useCallback(() => {
    setTaken((count) => count + 1);
    return () => setTaken((count) => count - 1);
  }, []);
  return [taken, handOver];
}

/** The hand-over a locked frame offers the panel drawn in its body. */
export const PanelLockHandOverContext = createContext<(() => () => void) | null>(null);

/**
 * For a service's panel: takes over the lock its frame holds, and says whether
 * it is locked. While it is, the panel is what keeps itself out of reach, so it
 * must lock everything in it that writes. Only a frame that took the use's lock
 * over offers it; anywhere else the panel stays locked whole, and this only
 * says so.
 */
export function usePanelBlockLock(): boolean {
  const locked = useInsideBlockUse();
  const handOver = useContext(PanelLockHandOverContext);
  // Before paint, as the frame's: drawn read-only from the start.
  useLayoutEffect(() => (handOver ? handOver() : undefined), [handOver]);
  return locked;
}

type UseInfo = {
  placed: PlacedBlock;
  definition: BlockDefinition | undefined;
  /** Whether nothing attached contains it — the uses a person may detach. */
  outermost: boolean;
  /** Whether it is the working copy its block is being edited on. */
  editing: boolean;
  /** Whether some use on the board is — only one is, at a time. */
  anyEditing: boolean;
};

function usePlacedUse(address: string, runtimeId?: string): UseInfo | null {
  const blocks = useBoardContext()?.linkage?.blocks;
  const placed = blockUseAt(blocks, address, runtimeId);
  if (!blocks || !placed) {
    return null;
  }
  return {
    placed,
    definition: blocks.definitions[placed.document]?.find(
      (entry) => entry.id === placed.use.block,
    ),
    outermost: outermostUses(blocks).includes(placed),
    editing: blocks.editing === placed.key,
    anyEditing: !!blocks.editing,
  };
}

type Props = {
  /** The service's address — its uuid at the top of a runtime, a dotted path below. */
  address: string;
  runtimeId?: string;
  /** What opening this service as its own level takes, when it hosts a pipeline. */
  level?: { id: string; label: string };
  /** Takes the service out of the pipeline holding it. */
  onRemove?: () => void;
  /**
   * Inside a use although nothing around it says so — a host that shows one
   * level of a pipeline at a time, like the mobile service sheet, knows where
   * it is from its own trail rather than from what it is drawn in.
   */
  locked?: boolean;
  children: React.ReactNode;
};

/**
 * A service's panel as the board draws it: unchanged, unless it is a use of a
 * block or sits inside one.
 */
export default function BlockUseFrame({
  address,
  runtimeId: ownRuntimeId,
  level,
  onRemove,
  locked = false,
  children,
}: Props) {
  const inside = useInsideBlockUse() || locked;
  const inherited = useContext(ServiceRuntimeContext);
  const runtimeId = ownRuntimeId ?? inherited;
  const use = usePlacedUse(address, runtimeId);
  // How many frames drawn directly in the panel have taken its lock over.
  const [handedOver, handOver] = useLockHandOver();
  // Only a locked panel has a lock to hand over.
  const lockedHere = !use?.editing && (!!use || inside);
  const addressed = (
    <ServiceRuntimeContext.Provider value={runtimeId}>
      <ServiceAddressContext.Provider value={address}>
        <LockHandOverContext.Provider value={lockedHere ? handOver : null}>
          {children}
        </LockHandOverContext.Provider>
      </ServiceAddressContext.Provider>
    </ServiceRuntimeContext.Provider>
  );
  if (!use && !inside) {
    return addressed;
  }
  // The one use unlocked as its block's working copy: edited like any other
  // service until the edit is applied to the block, or cancelled.
  if (use?.editing) {
    return (
      <div
        className="inline-flex flex-col p-1 rounded"
        data-block-use={use.placed.use.block}
        style={{ border: editFrame.border, background: editFrame.background }}
      >
        <EditBar use={use} />
        <BlockLockContext.Provider value={false}>{addressed}</BlockLockContext.Provider>
      </div>
    );
  }
  return (
    <div className="inline-flex flex-col" data-block-use={use ? use.placed.use.block : undefined}>
      {use ? (
        <UseBar
          use={use}
          editable={!inside}
          level={level}
          onRemove={inside ? undefined : onRemove}
        />
      ) : (
        level && <OpenLevel level={level} />
      )}
      <BlockLockContext.Provider value={true}>
        {/* A use shows its bar and not its panel: nothing in the panel can be
            changed, and the bar already says what can. The panel stays
            mounted all the same, because a level opened on the use is drawn
            from it. Inside a use, a panel is shown on the level it was
            opened on, dimmed as well as out of reach: a panel that ignores
            its controls has to say so before somebody tries them. A frame
            that took the lock over keeps its panel out of reach itself. */}
        <div
          inert={handedOver === 0}
          className="hkp-block-locked"
          style={use ? { display: "none" } : { opacity: 0.7 }}
        >
          {addressed}
        </div>
      </BlockLockContext.Provider>
    </div>
  );
}

function OpenLevel({ level }: { level: { id: string; label: string } }) {
  const navigation = useNestedNavigation();
  const depth = useLevelDepth();
  const inlineHops = useInlineHops();
  if (!navigation) {
    return null;
  }
  return (
    <button
      className="hkp-svc-btn hkp-svc-btn--icon flex items-center self-start"
      onClick={() => navigation.open(level.id, level.label, depth, inlineHops > 0)}
      aria-label={`Open ${level.label} as its own level`}
      title={`Open ${level.label} as its own level`}
    >
      <Maximize2 size={14} strokeWidth={1.5} />
    </button>
  );
}

function UseBar({
  use,
  editable,
  level,
  onRemove,
}: {
  use: UseInfo;
  editable: boolean;
  level?: { id: string; label: string };
  onRemove?: () => void;
}) {
  const board = useBoardContext();
  // Anything smaller zooms iOS in on focus, and it stays zoomed.
  const fontSize = useIsMobileHost() ? 16 : 12;
  const { placed, definition, outermost } = use;
  const declared = definition?.params ?? {};
  const params = { ...declared, ...placed.use.params };

  const setParam = (name: string, value: unknown) => {
    if (Object.is(params[name], value)) {
      return;
    }
    void board
      ?.setBlockParams(placed.key, { [name]: value })
      .catch((err) => console.error("Could not change the block's params", err));
  };

  return (
    <div
      className="hkp-block-use-bar flex flex-col gap-1 mb-1 px-2 py-1 rounded"
      style={{
        // The bar is all a use shows, so it is as wide as what it says.
        minWidth: 180,
        fontSize,
        border: "1px solid var(--hkp-accent)",
        background: "var(--hkp-accent-dim)",
      }}
    >
      <div className="flex items-center gap-2">
        <Boxes size={14} strokeWidth={1.5} style={{ color: "var(--hkp-accent)" }} />
        <span className="truncate" title={definition?.description}>
          Block · {definition?.name ?? placed.use.block}
        </span>
        <div className="flex items-center gap-1 ml-auto">
          {level && <OpenLevel level={level} />}
          {editable && outermost && !use.anyEditing && (
            <button
              className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
              onClick={() => board?.editBlock(placed.key)}
              aria-label="Edit block"
              title="Edit the block here: what you change applies to every use of it"
            >
              <Pencil size={14} strokeWidth={1.5} />
            </button>
          )}
          {editable && outermost && (
            <button
              className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
              onClick={() => board?.detachBlockUse(placed.key)}
              aria-label="Detach from block"
              title="Detach: make this an ordinary copy that no longer follows the block"
            >
              <Unlink size={14} strokeWidth={1.5} />
            </button>
          )}
          {editable && onRemove && (
            <button
              className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
              onClick={onRemove}
              aria-label="Remove this use"
              title="Remove this use"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
      {Object.keys(declared).length > 0 && (
        <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
          {Object.keys(declared).map((name) => (
            <React.Fragment key={name}>
              <label htmlFor={`${placed.key}-${name}`} className="opacity-70">
                {name}
              </label>
              <ParamField
                fontSize={fontSize}
                id={`${placed.key}-${name}`}
                value={params[name]}
                fallback={declared[name]}
                disabled={!editable}
                onCommit={(value) => setParam(name, value)}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Apply and cancel, for a level opened on the working copy: the bar the copy
 * wears on the level it sits on is out of reach while a level of it is in
 * front. Renders nothing anywhere else.
 */
export function BlockEditActions() {
  const address = useServiceAddress();
  const blocks = useBoardContext()?.linkage?.blocks;
  const placed = blocks?.placed.find((entry) => entry.key === blocks.editing);
  if (!blocks || !placed || placed.address !== address) {
    return null;
  }
  return (
    <EditBar
      inline
      use={{
        placed,
        definition: blocks.definitions[placed.document]?.find(
          (entry) => entry.id === placed.use.block,
        ),
        outermost: true,
        editing: true,
        anyEditing: true,
      }}
    />
  );
}

/** How a use being edited as its block's working copy is marked out. */
const editFrame = {
  border: "1px dashed var(--hkp-accent)",
  background: "var(--hkp-accent-dim)",
};

/**
 * What a use being edited as its block's working copy wears instead of its
 * bar. Above the panel it is the heading of the frame both share; in a
 * level's header it stands alone, and is framed itself.
 */
function EditBar({ use, inline = false }: { use: UseInfo; inline?: boolean }) {
  const board = useBoardContext();
  const fontSize = useIsMobileHost() ? 16 : 12;
  const [busy, setBusy] = useState(false);
  const run = (action?: () => Promise<void>) => {
    if (!action) {
      return;
    }
    setBusy(true);
    action()
      .catch((err) => console.error("Could not finish editing the block", err))
      .finally(() => setBusy(false));
  };
  return (
    <div
      className={`hkp-block-use-bar flex items-center gap-2 px-2 py-1 rounded ${inline ? "" : "mb-1"}`}
      style={{
        // Above a panel it is as wide as the panel; in a level's header, as
        // wide as what it says.
        ...(inline ? editFrame : { contain: "inline-size" as const }),
        fontSize,
      }}
    >
      <Pencil size={14} strokeWidth={1.5} style={{ color: "var(--hkp-accent)" }} />
      <span
        className="truncate"
        title="Changes made here apply to every use of the block once applied"
      >
        Editing block · {use.definition?.name ?? use.placed.use.block}
      </span>
      <div className="flex items-center gap-1 ml-auto">
        <button
          className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
          disabled={busy}
          onClick={() => run(board?.applyBlockEdit)}
          aria-label="Apply to the block"
          title="Apply: every use of the block takes these changes"
        >
          <Check size={14} strokeWidth={1.5} />
        </button>
        <button
          className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
          disabled={busy}
          onClick={() => run(board?.cancelBlockEdit)}
          aria-label="Cancel editing the block"
          title="Cancel: put this use back as the block makes it"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * One parameter, edited as the type its default has.
 *
 * Not committed on every keystroke: each change re-instantiates the use,
 * which restarts whatever runs inside it. Text commits on blur or Enter; a
 * number also shortly after it stops changing, since its stepper arrows are
 * a way of changing it that involves neither.
 */
function ParamField({
  id,
  value,
  fallback,
  disabled,
  fontSize,
  onCommit,
}: {
  fontSize: number;
  id: string;
  value: unknown;
  fallback: unknown;
  disabled: boolean;
  onCommit: (value: unknown) => void;
}) {
  const kind = typeof fallback;
  const [text, setText] = useState(String(value ?? ""));
  useEffect(() => setText(String(value ?? "")), [value]);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settle.current) {
      clearTimeout(settle.current);
    }
  }, []);

  if (kind === "boolean") {
    return (
      <input
        id={id}
        type="checkbox"
        checked={value === true}
        disabled={disabled}
        onChange={(event) => onCommit(event.target.checked)}
      />
    );
  }
  if (kind !== "number" && kind !== "string") {
    return <code className="truncate">{JSON.stringify(value)}</code>;
  }
  const commit = (current = text) => {
    if (settle.current) {
      clearTimeout(settle.current);
      settle.current = null;
    }
    if (kind === "number") {
      const parsed = Number(current);
      if (current.trim() === "" || Number.isNaN(parsed)) {
        setText(String(value ?? ""));
        return;
      }
      onCommit(parsed);
    } else {
      onCommit(current);
    }
  };
  return (
    <input
      id={id}
      className="px-1 rounded border min-w-0"
      style={{ fontSize }}
      type={kind === "number" ? "number" : "text"}
      step={kind === "number" ? stepOf(fallback as number) : undefined}
      value={text}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (kind === "number") {
          if (settle.current) {
            clearTimeout(settle.current);
          }
          settle.current = setTimeout(() => commit(next), NUMBER_SETTLE_MS);
        }
      }}
      onBlur={() => commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        }
      }}
    />
  );
}
