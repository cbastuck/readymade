import { Lane, Marker, Playhead, Preview, Ruler } from "./parts";
import Transport from "./Transport";
import { displayLength, objectAt, TimelineView, withImage } from "./model";

/**
 * The Timeline as it sits on the board: where it is, what it draws there, and
 * one row with everything placed on it — keyframes of every property and the
 * actions. Editing them is the editor's; this is for watching and scrubbing.
 */
export default function TimelinePanel({
  view,
  cursor,
  pinned,
  readOnly,
  configure,
  onScrub,
  onFollow,
  onExpand,
}: {
  view: TimelineView;
  cursor: number;
  pinned: boolean;
  readOnly: boolean;
  configure: (config: Record<string, unknown>) => void;
  onScrub?: (t: number) => void;
  onFollow: () => void;
  onExpand: () => void;
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
      <Transport
        view={view}
        cursor={cursor}
        length={length}
        pinned={pinned}
        readOnly={readOnly}
        configure={configure}
        onFollow={onFollow}
        onExpand={onExpand}
      />
      {view.object && (
        <Preview
          drawable={objectAt(view, cursor)}
          width={300}
          height={170}
          onImage={
            readOnly ? undefined : (url) => configure({ object: withImage(view.object, url) })
          }
        />
      )}
      <div className="relative flex flex-col gap-1">
        <Ruler length={length} onScrub={onScrub} />
        <Lane markers={markers} length={length} onScrub={onScrub} />
        <Playhead t={cursor} length={length} />
      </div>
      {!view.object && !readOnly && (
        <Preview
          drawable={null}
          width={300}
          height={44}
          onImage={(url) => configure({ object: withImage(null, url) })}
        >
          Drop an image here to animate it on this timeline
        </Preview>
      )}
    </div>
  );
}
