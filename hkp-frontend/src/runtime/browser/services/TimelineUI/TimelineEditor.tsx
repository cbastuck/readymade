import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import Select from "hkp-frontend/src/ui-components/Select";
import { Ease } from "../timeline-core";
import { Bars, Field, KeyButton, Lane, Playhead, Preview, Ruler } from "./parts";
import Transport from "./Transport";
import {
  addAction,
  addPlacement,
  indexOfPlacement,
  movePlacement,
  placementNames,
  removePlacement,
  renamePlacements,
  resizePlacement,
  displayLength,
  EASES,
  formatTime,
  formatValue,
  isKeyframed,
  keyframeAt,
  moveAction,
  moveKeyframe,
  objectAt,
  parseFieldValue,
  propertiesOf,
  removeAction,
  removeKeyframe,
  setActionData,
  setEase,
  setValue,
  TimelineView,
  toggleKey,
  valueOf,
  withImage,
} from "./model";

/** The width of the column naming each row, so every lane spans the same time. */
const LABEL = 200;

type Selection =
  | { kind: "key"; property: string; index: number }
  | { kind: "action"; index: number }
  | { kind: "placement"; index: number }
  | null;

/**
 * The Timeline laid out to be edited: one lane per property of its object,
 * each with its value at the playhead, and a lane for the actions.
 *
 * Values are set where the playhead is. On a property that is not animated
 * yet, a value is simply the object's; its key button sets a keyframe there,
 * and from then on every value typed sets one at the playhead.
 */
export default function TimelineEditor({
  view,
  cursor,
  pinned,
  readOnly,
  configure,
  onScrub,
  onFollow,
}: {
  view: TimelineView;
  cursor: number;
  pinned: boolean;
  /** Shown, not edited: picking a keyframe or action still shows it. */
  readOnly: boolean;
  configure: (config: Record<string, unknown>) => void;
  onScrub?: (t: number) => void;
  onFollow: () => void;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [newProperty, setNewProperty] = useState("");
  const length = displayLength(view);
  const own = view.clock === "own";
  const properties = propertiesOf(view, extra);

  const settings = (
    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-mid)" }}>
      <label className="flex items-center gap-1">
        length
        <Field
          width={52}
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
      {own ? (
        <>
          <label className="flex items-center gap-1">
            fps
            <Field
              width={40}
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
        <>
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
        </>
      )}
    </div>
  );

  const propertyRow = (property: string) => {
    const frames = view.keyframes[property] ?? [];
    const animated = isKeyframed(view, property);
    const here = keyframeAt(frames, cursor) >= 0;
    return (
      <div key={property} className="flex items-center">
        <div className="flex shrink-0 items-center gap-1.5" style={{ width: LABEL }}>
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
            here={here}
            onClick={() => configure(toggleKey(view, property, cursor))}
          />
        </div>
        <div className="flex-1 pl-2">
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
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <Transport
        view={view}
        cursor={cursor}
        length={length}
        pinned={pinned}
        readOnly={readOnly}
        configure={configure}
        onFollow={onFollow}
      />
      {readOnly && (
        <div className="text-xs" style={{ color: "var(--text-mid)" }}>
          This timeline is inside a use of a block, so it is shown here but not
          edited: its block's definition is where it changes, for every use at once.
        </div>
      )}
      {settings}

      <div className="flex flex-wrap items-start gap-4">
        <Preview
          drawable={objectAt(view, cursor)}
          width={360}
          height={220}
          onImage={
            readOnly ? undefined : (url) => configure({ object: withImage(view.object, url) })
          }
        />
        <Inspector
          view={view}
          readOnly={readOnly}
          selection={selection}
          configure={configure}
          onSelect={setSelection}
          onDeselect={() => setSelection(null)}
        />
      </div>

      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-end">
          <div className="shrink-0 text-xs" style={{ width: LABEL, color: "var(--text-mid)" }}>
            {view.object
              ? "properties"
              : readOnly
                ? "no object"
                : "no object: drop an image on the preview"}
          </div>
          <div className="flex-1 pl-2">
            <Ruler length={length} onScrub={onScrub} />
          </div>
        </div>

        {view.object && properties.map(propertyRow)}

        {view.object && !readOnly && (
          <div className="flex items-center gap-1.5" style={{ width: LABEL }}>
            <input
              value={newProperty}
              placeholder="another property"
              className="flex-1 rounded px-1 py-0.5 text-xs"
              style={{ background: "transparent", border: "1px solid var(--border-mid)" }}
              onChange={(event) => setNewProperty(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newProperty.trim()) {
                  setExtra([...extra, newProperty.trim()]);
                  setNewProperty("");
                }
              }}
            />
          </div>
        )}

        <PlacementRows
          view={view}
          length={length}
          cursor={cursor}
          readOnly={readOnly}
          selection={selection}
          configure={configure}
          onScrub={onScrub}
          onSelect={setSelection}
        />

        <div className="mt-1 flex items-center">
          <div className="flex shrink-0 items-center gap-1.5" style={{ width: LABEL }}>
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
          </div>
          <div className="flex-1 pl-2">
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
          </div>
        </div>

        <Playhead t={cursor} length={length} inset={LABEL + 8} />
      </div>
    </div>
  );
}

/** What is selected on a lane, and what can be done to it. */
function Inspector({
  view,
  readOnly,
  selection,
  configure,
  onSelect,
  onDeselect,
}: {
  view: TimelineView;
  readOnly: boolean;
  selection: Selection;
  configure: (config: Record<string, unknown>) => void;
  onSelect: (selection: Selection) => void;
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
      <div className="flex flex-col gap-2 text-xs" style={{ minWidth: 220 }}>
        <div style={{ color: "var(--text)" }}>
          {selection.property} at {formatTime(key.at)}: {formatValue(key.value)}
        </div>
        <label className="flex items-center gap-2" style={{ color: "var(--text-mid)" }}>
          towards the next keyframe
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
        </label>
        {!readOnly && (
          <DeleteButton
            onClick={() => {
              configure(removeKeyframe(view, selection.property, selection.index));
              onDeselect();
            }}
          />
        )}
      </div>
    );
  }

  if (selection?.kind === "placement") {
    const placement = view.placements[selection.index];
    if (!placement) {
      return null;
    }
    const update = (next: typeof placement) => {
      const placements = view.placements.map((p, i) => (i === selection.index ? next : p));
      configure({ placements });
      // The service keeps them in the order they start, so find it again.
      const found = indexOfPlacement([...placements].sort((a, b) => a.at - b.at), next);
      onSelect(found >= 0 ? { kind: "placement", index: found } : null);
    };
    return (
      <div className="flex flex-col gap-2 text-xs" style={{ minWidth: 220, color: "var(--text-mid)" }}>
        <div style={{ color: "var(--text)" }}>placement of "{placement.name}"</div>
        <label className="flex items-center gap-2">
          name
          <Field
            width={110}
            readOnly={readOnly}
            value={placement.name}
            onCommit={(text) => text.trim() && update({ ...placement, name: text.trim() })}
          />
        </label>
        <label className="flex items-center gap-2">
          starts at
          <Field
            width={60}
            readOnly={readOnly}
            value={formatValue(placement.at)}
            onCommit={(text) => update({ ...placement, at: Math.max(0, Number(text) || 0) })}
          />
        </label>
        <label className="flex items-center gap-2">
          lasts
          <Field
            width={60}
            readOnly={readOnly}
            value={formatValue(placement.duration)}
            onCommit={(text) =>
              Number(text) > 0 && update({ ...placement, duration: Number(text) })
            }
          />
        </label>
        {!readOnly && (
          <DeleteButton
            onClick={() => {
              configure({ placements: removePlacement(view.placements, selection.index) });
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
      draft?.index === selection.index ? draft.text : JSON.stringify(action.data ?? null, null, 2);
    return (
      <div className="flex flex-col gap-2 text-xs" style={{ minWidth: 260 }}>
        <div style={{ color: "var(--text)" }}>
          action at {formatTime(action.at)}, emits
        </div>
        <textarea
          value={text}
          readOnly={readOnly}
          rows={5}
          className="rounded p-1 font-mono text-xs"
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
          <DeleteButton
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

  if (readOnly) {
    return (
      <div className="max-w-[260px] text-xs" style={{ color: "var(--text-mid)" }}>
        Pick a keyframe or an action to see it.
      </div>
    );
  }

  return (
    <div className="max-w-[260px] text-xs" style={{ color: "var(--text-mid)" }}>
      Move the playhead, then type a value: a property with keyframes gets one
      there. The ◆ button starts animating a property, or takes away the keyframe
      at the playhead. Drag keyframes and actions along their lanes; pick one to
      ease it or edit what it emits.
    </div>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="hkp-svc-btn flex w-fit items-center gap-1"
      onClick={onClick}
    >
      <Trash2 size={13} /> Remove
    </button>
  );
}

/**
 * The names this timeline places, one row each, with their placements as
 * bars. A driven timeline below takes a name to play when and for as long as
 * its bars say — stretched to fit, unless it loops.
 */
function PlacementRows({
  view,
  length,
  cursor,
  readOnly,
  selection,
  configure,
  onScrub,
  onSelect,
}: {
  view: TimelineView;
  length: number;
  cursor: number;
  readOnly: boolean;
  selection: Selection;
  configure: (config: Record<string, unknown>) => void;
  onScrub?: (t: number) => void;
  onSelect: (selection: Selection) => void;
}) {
  const [newName, setNewName] = useState("");
  const names = placementNames(view.placements);

  /** Configures placements and keeps the one being edited selected, wherever sorting puts it. */
  const edit = (placements: typeof view.placements, index: number) => {
    configure({ placements });
    const sorted = [...placements].sort((a, b) => a.at - b.at);
    const found = indexOfPlacement(sorted, placements[index]);
    onSelect(found >= 0 ? { kind: "placement", index: found } : null);
  };

  const place = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    const placements = addPlacement(view.placements, name, cursor);
    edit(placements, placements.length - 1);
    setNewName("");
  };

  if (readOnly && names.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-1 text-xs" style={{ color: "var(--text-mid)" }}>
        placements
      </div>
      {names.map((name) => {
        const indices = view.placements
          .map((p, index) => ({ p, index }))
          .filter(({ p }) => p.name === name);
        return (
          <div key={name} className="flex items-center">
            <div className="flex shrink-0 items-center gap-1.5" style={{ width: LABEL }}>
              <Field
                width={LABEL - 8}
                readOnly={readOnly}
                title="Renames every placement of this name"
                value={name}
                onCommit={(text) =>
                  text.trim() &&
                  configure({ placements: renamePlacements(view.placements, name, text.trim()) })
                }
              />
            </div>
            <div className="flex-1 pl-2">
              <Bars
                length={length}
                onScrub={onScrub}
                bars={indices.map(({ p, index }) => ({
                  at: p.at,
                  duration: p.duration,
                  title: `${name}: ${formatTime(p.at)} for ${formatTime(p.duration)}`,
                  selected: selection?.kind === "placement" && selection.index === index,
                }))}
                onSelect={(i) => onSelect({ kind: "placement", index: indices[i].index })}
                onMove={
                  readOnly
                    ? undefined
                    : (i, at) => edit(movePlacement(view.placements, indices[i].index, at), indices[i].index)
                }
                onResize={
                  readOnly
                    ? undefined
                    : (i, duration) =>
                        edit(
                          resizePlacement(view.placements, indices[i].index, duration),
                          indices[i].index,
                        )
                }
              />
            </div>
          </div>
        );
      })}
      {!readOnly && (
        <div className="flex items-center gap-1.5" style={{ width: LABEL }}>
          <input
            value={newName}
            placeholder="place a name at the playhead"
            className="flex-1 rounded px-1 py-0.5 text-xs"
            style={{ background: "transparent", border: "1px solid var(--border-mid)" }}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                place();
              }
            }}
          />
          <button
            type="button"
            className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
            title="Place this name at the playhead"
            disabled={!newName.trim()}
            onClick={place}
          >
            <Plus size={14} />
          </button>
        </div>
      )}
    </>
  );
}

