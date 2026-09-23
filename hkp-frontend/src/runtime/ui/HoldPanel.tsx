import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import Select from "hkp-frontend/src/ui-components/Select";

/**
 * Hold's panel, in whichever of its two arrangements the service is using.
 *
 * Which side is calling can be said by the **value** — a property only the
 * producer carries — or by the **board**, which is a slot two Holds name and a
 * role each declares. They are alternatives, and the service reports only the
 * one it is using, so this shows one or the other rather than both: a field the
 * service does not act on is one a reader has to discount, and editing it here
 * would switch the arrangement without saying so.
 *
 * Kept apart from either runtime's wrapper because Hold is one service: a
 * browser Hold and a Hold on a REST runtime differ in how a panel reaches them,
 * not in what there is to see. Each runtime's HoldUI supplies the wrapper and
 * the `configure` that reaches its own service.
 */
export type HoldPanelState = {
  property: string;
  slot: string;
  op: "read" | "write";
  held: unknown;
  readCount: number;
  writeCount: number;
};

/** What a Hold's notification says, read into panel state. */
export function readHoldState(
  state: any,
  previous: HoldPanelState,
): HoldPanelState {
  return {
    // Absent means "not this arrangement", so it is read as empty rather than
    // left at whatever the other one last showed.
    property: typeof state?.property === "string" ? state.property : "",
    slot: typeof state?.slot === "string" ? state.slot : "",
    op: state?.op === "read" || state?.op === "write" ? state.op : previous.op,
    held: state?.held !== undefined ? state.held : previous.held,
    readCount:
      state?.readCount !== undefined ? state.readCount : previous.readCount,
    writeCount:
      state?.writeCount !== undefined ? state.writeCount : previous.writeCount,
  };
}

/**
 * The frame a Hold opens at. Its explanations would otherwise set the width,
 * running each on a single line.
 */
export const HOLD_PANEL_SIZE = { width: 300, height: undefined };

export const EMPTY_HOLD_STATE: HoldPanelState = {
  property: "",
  slot: "",
  op: "read",
  held: null,
  readCount: 0,
  writeCount: 0,
};

type Props = {
  state: HoldPanelState;
  /** Applied locally so the field does not wait for the service to answer. */
  onLocalChange: (next: Partial<HoldPanelState>) => void;
  configure: (config: Record<string, unknown>) => void;
};

export default function HoldPanel({ state, onLocalChange, configure }: Props) {
  const { property, slot, op, held, readCount, writeCount } = state;

  // Null is the empty value, not a held one.
  const hasHeld = held !== null;
  // A slot is what the service reports when that is the arrangement in use.
  const bySlot = slot !== "";

  const setProperty = (value: string) => onLocalChange({ property: value });
  const setSlot = (value: string) => onLocalChange({ slot: value });
  const setOp = (value: "read" | "write") => onLocalChange({ op: value });

  /** Moves the service to the other arrangement, and says so in one call. */
  const useArrangement = (next: "property" | "slot") => {
    if (next === "slot") {
      setSlot("document");
      configure({ slot: "document", op, property: "" });
      return;
    }
    setSlot("");
    configure({ slot: "", property });
  };

  return (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 text-xs">
      <span className="text-neutral-500">tell the sides apart by</span>
      <Select
        title="tell the sides apart by"
        value={bySlot ? "declared role" : "input property"}
        options={["input property", "declared role"]}
        onChange={(value: string) =>
          useArrangement(value === "declared role" ? "slot" : "property")
        }
      />
    </div>

    {bySlot ? (
      <>
        <InputField
          label="Slot"
          value={slot}
          onChange={(value) => {
            setSlot(value);
            configure({ slot: value });
          }}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-500">this end</span>
          <Select
            title="this end"
            value={op}
            options={["write", "read"]}
            onChange={(value: string) => {
              setOp(value as "read" | "write");
              configure({ op: value });
            }}
          />
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Two Holds naming one slot are its two ends. A write stores its
          input and passes it on unchanged; a read emits what is held, and
          stops while nothing is. Nothing looks at the value, so the two ends
          may sit in pipelines that never meet — both renaming the slot is
          what keeps them paired.
        </div>
      </>
    ) : (
      <>
        <InputField
          label="Property"
          value={property}
          onChange={(value) => {
            setProperty(value);
            configure({ property: value });
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          An input carrying this property replaces what is held. Every call
          emits the held value under the same name, and stops while nothing
          is held. The arrangement for two sides sharing one pipeline, where
          the value is all there is to tell them apart.
        </div>
      </>
    )}

    <div className="flex items-center justify-between">
      {/* Which side has been calling — a producer that has stopped writing
          shows up here as reads without writes. */}
      <span style={{ fontSize: 12, opacity: 0.7 }}>
        reads: {readCount} · writes: {writeCount}
      </span>
      <Button
        className="hkp-svc-btn"
        disabled={!hasHeld}
        onClick={() => configure({ action: "clear" })}
      >
        Clear
      </Button>
    </div>

    <div className="border border-gray-300 p-2">
      <h3 className="tracking-[6px]">Held</h3>
      <pre
        style={{
          fontSize: 12,
          margin: 0,
          maxHeight: 160,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {hasHeld ? JSON.stringify(held, null, 2) : "nothing held yet"}
      </pre>
    </div>
  </div>
  );
}
