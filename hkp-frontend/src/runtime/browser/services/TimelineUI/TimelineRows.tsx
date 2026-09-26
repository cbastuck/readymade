import { ReactNode, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import Select from "hkp-frontend/src/ui-components/Select";
import { Ease, Placement } from "../timeline-core";
import { Bars, Field, KeyButton, Lane, Playhead, Ruler } from "./parts";
import {
  addAction,
  addPlacement,
  displayLength,
  EASES,
  formatTime,
  formatValue,
  indexOfPlacement,
  isKeyframed,
  keyframeAt,
  moveAction,
  moveKeyframe,
  movePlacement,
  parseFieldValue,
  placementNames,
  propertiesOf,
  removeAction,
  removeKeyframe,
  removePlacement,
  renamePlacements,
  resizePlacement,
  setActionData,
  setEase,
  setValue,
  TimelineView,
  toggleKey,
  valueOf,
} from "./model";

/** The width of the column naming each row, so every lane spans the same time. */
const LABEL = 208;

/** How wide the panel grows to show its rows. */
export const ROWS_WIDTH = 660;

type Selection =
  | { kind: "key"; property: string; index: number }
  | { kind: "action"; index: number }
  | { kind: "placement"; index: number }
  | null;

type Props = {
  view: TimelineView;
  cursor: number;
  /** Shown, not edited: picking a keyframe, placement or action still shows it. */
  readOnly: boolean;
  configure: (config: Record<string, unknown>) => void;
  onScrub?: (t: number) => void;
};

/**
 * The Timeline grown to show its rows: a row per property of its object —
 * its value at the playhead, its key button, its keyframes — a row per name it
 * places, and the actions. Everything is set where the playhead is: on a
 * property not animated yet a value is simply the object's, and its key
 * button starts animating it.
 */
export default function TimelineRows({ view, cursor, readOnly, configure, onScrub }: Props) {
  const [selection, setSelection] = useState<Selection>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const length = displayLength(view);
  const properties = view.object ? propertiesOf(view, extra) : [];

  /** Configures placements and keeps the one edited selected, wherever sorting puts it. */
  const editPlacements = (placements: Placement[], edited: Placement | null) => {
    configure({ placements });
    const sorted = [...placements].sort((a, b) => a.at - b.at);
    const found = edited ? indexOfPlacement(sorted, edited) : -1;
    setSelection(found >= 0 ? { kind: "placement", index: found } : null);
  };

  return (
    <div className="flex flex-col gap-1.5 pb-2" style={{ width: ROWS_WIDTH }}>
      <Settings view={view} readOnly={readOnly} configure={configure} />

      <div className="relative flex flex-col gap-1">
        <Row label={<Muted>{view.object ? "properties" : "no object"}</Muted>}>
          <Ruler length={length} onScrub={onScrub} />
        </Row>

        {properties.map((property) => {
          const frames = view.keyframes[property] ?? [];
          const animated = isKeyframed(view, property);
          return (
            <Row
              key={property}
              label={
                <>
                  <span
                    className="flex-1 truncate text-xs"
                    style={{ color: animated ? "var(--text)" : "var(--text-mid)" }}
                  >
                    {property}
                  </span>
                  <Field
                    readOnly={readOnly}
                    value={formatValue(valueOf(view, property, cursor))}
                    onCommit={(text) =>
                      configure(setValue(view, property, cursor, parseFieldValue(text)))
                    }
                  />
                  <KeyButton
                    disabled={readOnly}
                    animated={animated}
                    here={keyframeAt(frames, cursor) >= 0}
                    onClick={() => configure(toggleKey(view, property, cursor))}
                  />
                </>
              }
            >
              <Lane
                length={length}
                onScrub={onScrub}
                markers={frames.map((k, index) => ({
                  at: k.at,
                  shape: "key",
                  title: `${formatValue(k.value)} at ${formatTime(k.at)}${k.ease ? `, ${k.ease}` : ""}`,
                  selected:
                    selection?.kind === "key" &&
                    selection.property === property &&
                    selection.index === index,
                }))}
                onSelect={(index) => setSelection({ kind: "key", property, index })}
                onMove={
                  readOnly
                    ? undefined
                    : (index, at) => {
                        const moved = moveKeyframe(view.keyframes, property, index, at);
                        configure({ keyframes: moved.keyframes });
                        setSelection({ kind: "key", property, index: moved.index });
                      }
                }
              />
            </Row>
          );
        })}

        {placementNames(view.placements).map((name) => {
          const mine = view.placements
            .map((p, index) => ({ p, index }))
            .filter(({ p }) => p.name === name);
          // The start and duration shown are the picked placement's, else the first.
          const shown =
            mine.find(({ index }) => selection?.kind === "placement" && selection.index === index) ??
            mine[0];
          const update = (next: Placement) =>
            editPlacements(
              view.placements.map((p, i) => (i === shown.index ? next : p)),
              next,
            );
          return (
            <Row
              key={name}
              label={
                <>
                  <Field
                    width={76}
                    readOnly={readOnly}
                    title="Renames every placement of this name"
                    value={name}
                    onCommit={(text) =>
                      text.trim() &&
                      configure({
                        placements: renamePlacements(view.placements, name, text.trim()),
                      })
                    }
                  />
                  <Field
                    width={44}
                    readOnly={readOnly}
                    title="Starts at"
                    value={formatValue(shown.p.at)}
                    onCommit={(text) => update({ ...shown.p, at: Math.max(0, Number(text) || 0) })}
                  />
                  <Field
                    width={44}
                    readOnly={readOnly}
                    title="Lasts"
                    value={formatValue(shown.p.duration)}
                    onCommit={(text) =>
                      Number(text) > 0 && update({ ...shown.p, duration: Number(text) })
                    }
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
                      title="Remove this placement"
                      onClick={() =>
                        editPlacements(removePlacement(view.placements, shown.index), null)
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              }
            >
              <Bars
                length={length}
                onScrub={onScrub}
                bars={mine.map(({ p, index }) => ({
                  at: p.at,
                  duration: p.duration,
                  title: `${name}: ${formatTime(p.at)} for ${formatTime(p.duration)}`,
                  selected: shown.index === index && mine.length > 1,
                }))}
                onSelect={(i) => setSelection({ kind: "placement", index: mine[i].index })}
                onMove={
                  readOnly
                    ? undefined
                    : (i, at) => {
                        const moved = movePlacement(view.placements, mine[i].index, at);
                        editPlacements(moved, moved[mine[i].index]);
                      }
                }
                onResize={
                  readOnly
                    ? undefined
                    : (i, duration) => {
                        const resized = resizePlacement(view.placements, mine[i].index, duration);
                        editPlacements(resized, resized[mine[i].index]);
                      }
                }
              />
            </Row>
          );
        })}

        <Row
          label={
            <>
              <span className="flex-1 text-xs" style={{ color: "var(--text)" }}>
                actions
              </span>
              <button
                type="button"
                className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
                disabled={readOnly}
                title="Place an action at the playhead"
                onClick={() => {
                  configure({ actions: addAction(view.actions, cursor) });
                  setSelection({ kind: "action", index: view.actions.length });
                }}
              >
                <Plus size={14} />
              </button>
            </>
          }
        >
          <Lane
            length={length}
            onScrub={onScrub}
            markers={view.actions.map((a, index) => ({
              at: a.at,
              shape: "action",
              title: `${JSON.stringify(a.data)} at ${formatTime(a.at)}`,
              selected: selection?.kind === "action" && selection.index === index,
            }))}
            onSelect={(index) => setSelection({ kind: "action", index })}
            onMove={
              readOnly
                ? undefined
                : (index, at) => configure({ actions: moveAction(view.actions, index, at) })
            }
          />
        </Row>

        <Playhead t={cursor} length={length} inset={LABEL + 8} />
      </div>

      {!readOnly && (
        <Adders
          hasObject={!!view.object}
          onProperty={(name) => setExtra([...extra, name])}
          onPlace={(name) => {
            const placements = addPlacement(view.placements, name, cursor);
            editPlacements(placements, placements[placements.length - 1]);
          }}
        />
      )}

      <Selected
        view={view}
        readOnly={readOnly}
        selection={selection}
        configure={configure}
        onDeselect={() => setSelection(null)}
      />
    </div>
  );
}

/** A row: what it is on the left, its lane along the time axis on the right. */
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center">
      <div className="flex shrink-0 items-center gap-1" style={{ width: LABEL }}>
        {label}
      </div>
      <div className="flex-1 pl-2">{children}</div>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs" style={{ color: "var(--text-mid)" }}>
      {children}
    </span>
  );
}

/** The timeline's own settings, on one line. */
function Settings({
  view,
  readOnly,
  configure,
}: Pick<Props, "view" | "readOnly" | "configure">) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-mid)" }}>
      <label className="flex items-center gap-1">
        length
        <Field
          width={48}
          value={formatValue(view.length)}
          title="0 is unbounded"
          readOnly={readOnly}
          onCommit={(text) => configure({ length: Math.max(0, Number(text) || 0) })}
        />
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={view.loop}
          disabled={readOnly}
          onChange={(event) => configure({ loop: event.target.checked })}
        />
        loop
      </label>
      {view.clock === "own" ? (
        <>
          <label className="flex items-center gap-1">
            fps
            <Field
              width={36}
              value={formatValue(view.fps)}
              readOnly={readOnly}
              onCommit={(text) => configure({ fps: Number(text) })}
            />
          </label>
          <label className="flex items-center gap-1">
            counts in
            <Select
              compact
              disabled={readOnly}
              value={view.unit}
              options={["s", "beats"]}
              onChange={(unit) => configure({ unit })}
            />
          </label>
        </>
      ) : (
        <label
          className="flex items-center gap-1"
          title="The name this timeline takes from its driver's placements; empty, it plays in its driver's time"
        >
          placement
          <Field
            width={96}
            value={view.placement}
            readOnly={readOnly}
            onCommit={(text) => configure({ placement: text.trim() })}
          />
        </label>
      )}
    </div>
  );
}

/** Adding a row: a property to animate, or a name to place at the playhead. */
function Adders({
  hasObject,
  onProperty,
  onPlace,
}: {
  hasObject: boolean;
  onProperty: (name: string) => void;
  onPlace: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {hasObject && <AddInput placeholder="+ property" onAdd={onProperty} />}
      <AddInput placeholder="+ place a name at the playhead" onAdd={onPlace} />
    </div>
  );
}

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [text, setText] = useState("");
  return (
    <input
      value={text}
      placeholder={placeholder}
      className="rounded px-1 py-0.5 text-xs"
      style={{ width: 200, background: "transparent", border: "1px solid var(--border-mid)" }}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && text.trim()) {
          onAdd(text.trim());
          setText("");
        }
      }}
    />
  );
}

/**
 * What a picked keyframe or action has beyond its place on the lane: a
 * keyframe's ease, an action's data. A placement's all sits in its row.
 */
function Selected({
  view,
  readOnly,
  selection,
  configure,
  onDeselect,
}: {
  view: TimelineView;
  readOnly: boolean;
  selection: Selection;
  configure: (config: Record<string, unknown>) => void;
  onDeselect: () => void;
}) {
  const [draft, setDraft] = useState<{ index: number; text: string } | null>(null);
  const [error, setError] = useState(false);

  if (selection?.kind === "key") {
    const key = view.keyframes[selection.property]?.[selection.index];
    if (!key) {
      return null;
    }
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-mid)" }}>
        <span style={{ color: "var(--text)" }}>
          {selection.property} at {formatTime(key.at)}: {formatValue(key.value)}
        </span>
        <span>towards the next keyframe</span>
        <Select
          compact
          disabled={readOnly}
          value={key.ease ?? "linear"}
          options={EASES}
          onChange={(ease) =>
            configure({
              keyframes: setEase(view.keyframes, selection.property, selection.index, ease as Ease),
            })
          }
        />
        {!readOnly && (
          <RemoveButton
            onClick={() => {
              configure(removeKeyframe(view, selection.property, selection.index));
              onDeselect();
            }}
          />
        )}
      </div>
    );
  }

  if (selection?.kind === "action") {
    const action = view.actions[selection.index];
    if (!action) {
      return null;
    }
    const text =
      draft?.index === selection.index ? draft.text : JSON.stringify(action.data ?? null);
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-mid)" }}>
        <span style={{ color: "var(--text)" }}>action at {formatTime(action.at)} emits</span>
        <input
          value={text}
          readOnly={readOnly}
          className="flex-1 rounded px-1 py-0.5 font-mono text-xs"
          style={{
            background: "transparent",
            border: `1px solid ${error ? "#dc2626" : "var(--border-mid)"}`,
            color: "var(--text)",
          }}
          onChange={(event) => {
            setDraft({ index: selection.index, text: event.target.value });
            setError(false);
          }}
          onBlur={() => {
            if (draft?.index !== selection.index) {
              return;
            }
            try {
              configure({
                actions: setActionData(view.actions, selection.index, JSON.parse(draft.text)),
              });
              setDraft(null);
            } catch {
              setError(true);
            }
          }}
        />
        {!readOnly && (
          <RemoveButton
            onClick={() => {
              configure({ actions: removeAction(view.actions, selection.index) });
              setDraft(null);
              onDeselect();
            }}
          />
        )}
      </div>
    );
  }

  return null;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
      title="Remove"
      onClick={onClick}
    >
      <Trash2 size={12} />
    </button>
  );
}
