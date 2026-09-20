import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

import Select from "hkp-frontend/src/ui-components/Select";

/**
 * The cells a scope's services hold values in, as its panel shows them.
 *
 * A slot is the one thing a scope does that leaves no trace in the pipeline: a
 * Hold writes a cell on one schedule and another reads it on a different one,
 * and nothing on screen would otherwise say the cell existed, let alone what
 * was in it or who else could see it.
 *
 * **Folded, and folded again.** A cell holds whatever a pipeline put in it —
 * an article, a frame, a document — so a panel that drew every value would be
 * mostly somebody else's data, and a scope holding several would push its own
 * pipeline off the screen. So the section opens to the slot *names*, which are
 * what a board is written in terms of, and a name opens to its value. Nothing
 * is drawn until it is asked for.
 *
 * Whether the cells are the scope's own is said by **colour**, so that it is
 * read at a glance and per row rather than once in a heading: inherited cells
 * are greyed, because they are not this scope's to account for — anything else
 * out there naming the same slot is writing these same cells. Cells of its own
 * are drawn in the panel's own text colour.
 *
 * **A value is read here and not written.** What the cells hold is what the
 * pipelines put there, and the one thing worth doing to that from outside is
 * taking a cell away — which is a different act from emptying it: an empty
 * cell is one a board named and nothing has filled yet, and a Hold reading
 * either answers the same nothing. Removing leaves no stale reading behind,
 * and the next write brings the name back.
 *
 * Presentational only, and kept apart from the browser wrapper for the same
 * reason HoldPanel is: what there is to see about a scope's cells does not
 * depend on how a panel reached them.
 */
type Props = {
  cells: [string, unknown][];
  /**
   * What the scope asks for, spelled as a board spells it.
   *
   * Separate from `inherited`, which is what it actually got: a scope can ask
   * to inherit where nothing around it has cells to lend.
   */
  slots: "own" | "inherit";
  /** Whether these cells belong to the scope around this one. */
  inherited: boolean;
  /** Open state is the host's, because it decides what it is worth reading. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent where a panel can read a scope's cells but not configure it. */
  onSlotsChange?: (slots: "own" | "inherit") => void;
  /**
   * Takes one cell away, and is the whole of what this panel does to them.
   *
   * Absent where a panel can read a scope's cells but not reach them — a
   * scope on a REST runtime.
   */
  onRemove?: (name: string) => void;
};

/** A cell's value, as much of it as a panel should hold. */
function shown(value: unknown): string {
  if (value === null || value === undefined) {
    return "empty";
  }
  if (value instanceof Uint8Array) {
    return `[${value.byteLength} bytes]`;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return `[${typeof value}]`;
  }
}

/** What either setting does, for whoever is deciding between them. */
function whatItMeans(slots: "own" | "inherit"): string {
  return slots === "inherit"
    ? "Inherit: the cells around this scope, so a slot named here is the same cell it names out there. Click for cells of its own."
    : "Own: cells this scope keeps to itself, so a slot named here is a different cell from one of the same name outside. Click to inherit the ones around it.";
}

function Chevron({ open }: { open: boolean }) {
  return open ? (
    <ChevronDown size={12} strokeWidth={1.5} />
  ) : (
    <ChevronRight size={12} strokeWidth={1.5} />
  );
}

export default function ScopeSlots({
  cells,
  slots,
  inherited,
  open,
  onOpenChange,
  onSlotsChange,
  onRemove,
}: Props) {
  // Which cells are showing their value. By name rather than by index, so a
  // cell that appears while the section is open does not take another's place.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="w-full flex flex-col mt-1" style={{ fontSize: 12 }}>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 text-gray-400 text-left"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          title="Named cells the services in this scope share values through."
        >
          {/* After the label rather than before it, so that Slots starts
              where Output above it starts: a fold mark on the left would
              indent the one row of the two that happens to fold. */}
          <span>Slots</span>
          <span>· {cells.length}</span>
          <Chevron open={open} />
        </button>

        {/* Nothing labels this on the row, because the row is already headed
            Slots: a second noun for them here — cells, data, shared state —
            would have a reader checking whether two things were meant. The
            control names the question instead, where the question is asked:
            `origin` heads the two options inside the dropdown, and they are
            spelled as a board spells them. */}
        <div
          className="ml-auto flex items-center gap-2 text-gray-400"
          title={whatItMeans(slots)}
        >
          {onSlotsChange ? (
            <Select
              title="Origin"
              compact
              value={slots}
              options={["own", "inherit"]}
              onChange={(next: string) =>
                onSlotsChange(next as "own" | "inherit")
              }
            />
          ) : (
            <span>{slots}</span>
          )}
        </div>
      </div>

      {open &&
        (cells.length === 0 ? (
          <div className="text-neutral-500 pl-5 mt-1">nothing held</div>
        ) : (
          <div className="flex flex-col mt-1">
            {cells.map(([name, value]) => (
              <div key={name} className="flex flex-col">
                {/* The name opens the cell and the bin takes it away, so they
                    are two controls on a row rather than one inside another. */}
                <div className="flex items-center gap-2">
                  <button
                    className={`flex items-center gap-2 pl-3 text-left ${
                      inherited ? "text-neutral-400" : "font-medium"
                    }`}
                    onClick={() => toggle(name)}
                    aria-expanded={expanded.has(name)}
                    title={`Show what ${name} is holding`}
                  >
                    <Chevron open={expanded.has(name)} />
                    <span className="truncate">{name}</span>
                  </button>

                  {onRemove && (
                    <button
                      className="hkp-svc-btn hkp-svc-btn--icon ml-auto flex items-center"
                      onClick={() => onRemove(name)}
                      aria-label={`Remove ${name}`}
                      title={`Remove ${name}. The next write brings it back.`}
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  )}
                </div>

                {expanded.has(name) && (
                  <pre
                    className="ml-8 mt-1 mb-1 border border-gray-300 p-2"
                    style={{
                      fontSize: 11,
                      maxHeight: 160,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {shown(value)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
