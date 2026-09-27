import { Bars, Lane, Marker, Playhead, Preview, Ruler } from "./parts";
import { displayLength, formatTime, objectAt, TimelineView, withImage } from "./model";

/**
 * The Timeline as it sits on the board: what it draws at the playhead, and
 * one row with everything placed on it — keyframes of every property and the
 * actions — with the names it places beneath. For watching and scrubbing;
 * editing is in its rows.
 */
export default function TimelinePanel({
  view,
  cursor,
  readOnly,
  configure,
  onScrub,
}: {
  view: TimelineView;
  cursor: number;
  readOnly: boolean;
  configure: (config: Record<string, unknown>) => void;
  onScrub?: (t: number) => void;
}) {
  const length = displayLength(view);
  const markers: Marker[] = [
    ...Object.entries(view.keyframes).flatMap(([property, frames]) =>
      frames.map((k) => ({ at: k.at, shape: "key" as const, title: property })),
    ),
    ...view.actions.map((a) => ({ at: a.at, shape: "action" as const, title: "action" })),
  ];

  return (
    <div className="flex flex-col gap-2 pb-2">
      {view.object && (
        <Preview
          drawable={objectAt(view, cursor)}
          width={288}
          height={160}
          onImage={
            readOnly ? undefined : (url) => configure({ object: withImage(view.object, url) })
          }
        />
      )}
      <div className="relative flex flex-col gap-1">
        <Ruler length={length} onScrub={onScrub} />
        <Lane markers={markers} length={length} onScrub={onScrub} />
        {view.placements.length > 0 && (
          <Bars
            height={14}
            length={length}
            onScrub={onScrub}
            bars={view.placements.map((p) => ({
              at: p.at,
              duration: p.duration,
              title: `${p.name}: ${formatTime(p.at)} for ${formatTime(p.duration)}`,
            }))}
          />
        )}
        <Playhead t={cursor} length={length} />
      </div>
    </div>
  );
}
