import { FoldVertical, Pause, Play, Radio, Square, UnfoldVertical } from "lucide-react";

import { ImageButton } from "./parts";
import { formatTime, placementNote, TimelineView, withImage } from "./model";

/**
 * Play, pause and stop for a timeline keeping its own clock, and where it is.
 * A driven timeline has no clock to control: it says what drives it instead,
 * and offers to follow its driver again after its playhead was set by hand.
 */
export default function Transport({
  view,
  cursor,
  length,
  pinned,
  readOnly = false,
  configure,
  onFollow,
  expanded,
  onToggleExpanded,
}: {
  view: TimelineView;
  cursor: number;
  length: number;
  pinned: boolean;
  readOnly?: boolean;
  configure: (config: Record<string, unknown>) => void;
  onFollow: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const own = view.clock === "own";
  const note = placementNote(view);
  const unit = own && view.unit === "beats" ? "beats" : "s";

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {own ? (
        <>
          <button
            type="button"
            className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
            title={view.running ? "Pause" : "Play"}
            disabled={readOnly}
            onClick={() => configure(view.running ? { pause: true } : { play: true })}
          >
            {view.running ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
            title="Stop, back to the start"
            disabled={readOnly}
            onClick={() => configure({ stop: true })}
          >
            <Square size={14} />
          </button>
        </>
      ) : (
        <span
          style={{ color: note?.warn ? "#d97706" : "var(--text-mid)" }}
          title={note?.warn ? "A name placed on one side only: check both are spelled the same" : undefined}
        >
          {note ? note.text : "driven"}
        </span>
      )}
      <span className="tabular-nums" style={{ color: "var(--text)" }}>
        {formatTime(cursor)}
        <span style={{ color: "var(--text-mid)" }}>
          {" "}
          / {formatTime(length)} {unit}
          {view.loop ? " ↻" : ""}
        </span>
      </span>
      {pinned && (
        <button
          type="button"
          className="hkp-svc-btn hkp-svc-btn--icon flex items-center gap-1"
          title="Follow the time driving this timeline again"
          onClick={onFollow}
        >
          <Radio size={14} />
          <span>live</span>
        </button>
      )}
      <div className="flex-1" />
      {readOnly && (
        <span title="Inside a use of a block: edited through its block" style={{ color: "var(--text-mid)" }}>
          read-only
        </span>
      )}
      {!readOnly && (
        <ImageButton onImage={(url) => configure({ object: withImage(view.object, url) })} />
      )}
      <button
        type="button"
        className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
        title={expanded ? "Back to the compact view" : "Show the timeline's rows"}
        onClick={onToggleExpanded}
      >
        {expanded ? <FoldVertical size={14} /> : <UnfoldVertical size={14} />}
      </button>
    </div>
  );
}
