import { useCallback, useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import { usePanelBlockLock } from "hkp-frontend/src/runtime/ui/BlockUse";
import { displayLength, EMPTY_VIEW, readView, TimelineView } from "./model";
import TimelinePanel from "./TimelinePanel";
import TimelineRows from "./TimelineRows";
import Transport from "./Transport";

/**
 * The Timeline's panel: compact — a preview and one row with everything on it
 * — or grown to show a row per property, per name it places, and for its
 * actions, where it is edited.
 *
 * Where the playhead is, and what scrubbing does, depends on the clock. A
 * timeline keeping its own is sought, so scrubbing it moves everything it
 * drives. A driven timeline's time is its driver's: scrubbing it pins its
 * playhead for editing, until it is told to follow its driver again.
 */
export default function TimelineUI(props: ServiceUIProps) {
  const [view, setView] = useState<TimelineView>(EMPTY_VIEW);
  // Kept here, above the frame: growing the panel switches its resizing off,
  // which draws the body anew.
  const [expanded, setExpanded] = useState(false);
  const [pinnedAt, setPinnedAt] = useState<number | null>(null);

  const onUpdate = useCallback((update: any) => {
    setView((previous) => readView(update, previous));
  }, []);

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 320, height: undefined }}
      // Grown, the panel is as wide as its rows rather than the size it was given.
      resizable={!expanded}
      onInit={onUpdate}
      onNotification={onUpdate}
    >
      <TimelineBody
        view={view}
        configure={(config) => props.service.configure(config)}
        expanded={expanded}
        onToggleExpanded={() => setExpanded(!expanded)}
        pinnedAt={pinnedAt}
        onPin={setPinnedAt}
      />
    </ServiceUI>
  );
}

/**
 * Drawn in the frame's body, where the lock of a block use can be taken over:
 * inside a use the timeline is shown read-only rather than out of reach, so its
 * rows can still be opened and looked through.
 */
function TimelineBody({
  view,
  configure,
  expanded,
  onToggleExpanded,
  pinnedAt,
  onPin,
}: {
  view: TimelineView;
  configure: (config: Record<string, unknown>) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  pinnedAt: number | null;
  onPin: (t: number | null) => void;
}) {
  const readOnly = usePanelBlockLock();
  const driven = view.clock === "input";
  const pinned = driven && pinnedAt !== null;
  const cursor = pinned ? (pinnedAt as number) : view.t;
  const write = readOnly ? () => {} : configure;

  // Pinning a driven timeline's playhead writes nothing, so it is left even
  // to a read-only view; seeking an own clock moves the board.
  const onScrub = driven
    ? (t: number) => onPin(t)
    : readOnly
      ? undefined
      : (t: number) => configure({ seek: t });

  return (
    <div className="flex flex-col gap-2">
      <Transport
        view={view}
        cursor={cursor}
        length={displayLength(view)}
        pinned={pinned}
        readOnly={readOnly}
        configure={write}
        onFollow={() => onPin(null)}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />
      {expanded ? (
        <TimelineRows
          view={view}
          cursor={cursor}
          readOnly={readOnly}
          configure={write}
          onScrub={onScrub}
        />
      ) : (
        <TimelinePanel
          view={view}
          cursor={cursor}
          readOnly={readOnly}
          configure={write}
          onScrub={onScrub}
        />
      )}
    </div>
  );
}
