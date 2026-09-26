import { useCallback, useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";
import { ServiceUIProps } from "hkp-frontend/src/types";
import { usePanelBlockLock } from "hkp-frontend/src/runtime/ui/BlockUse";
import { EMPTY_VIEW, readView, TimelineView } from "./model";
import TimelinePanel from "./TimelinePanel";
import TimelineEditor from "./TimelineEditor";

/**
 * The Timeline's panel, and the editor it opens.
 *
 * Where the playhead is, and what scrubbing does, depends on the clock. A
 * timeline keeping its own is sought, so scrubbing it moves everything it
 * drives. A driven timeline's time is its driver's: scrubbing it pins its
 * playhead for editing, until it is told to follow its driver again.
 */
export default function TimelineUI(props: ServiceUIProps) {
  const [view, setView] = useState<TimelineView>(EMPTY_VIEW);

  const onUpdate = useCallback((update: any) => {
    setView((previous) => readView(update, previous));
  }, []);

  return (
    <ServiceUI
      {...props}
      initialSize={{ width: 320, height: undefined }}
      onInit={onUpdate}
      onNotification={onUpdate}
    >
      <TimelineBody view={view} configure={(config) => props.service.configure(config)} />
    </ServiceUI>
  );
}

/**
 * Drawn in the frame's body, where the lock of a block use can be taken over:
 * inside a use the timeline is shown read-only rather than out of reach, so its
 * details can still be opened and looked through.
 */
function TimelineBody({
  view,
  configure,
}: {
  view: TimelineView;
  configure: (config: Record<string, unknown>) => void;
}) {
  const readOnly = usePanelBlockLock();
  const [expanded, setExpanded] = useState(false);
  const [pinnedAt, setPinnedAt] = useState<number | null>(null);

  const driven = view.clock === "input";
  const pinned = driven && pinnedAt !== null;
  const cursor = pinned ? (pinnedAt as number) : view.t;

  // Pinning a driven timeline's playhead writes nothing, so it is left even
  // to a read-only view; seeking an own clock moves the board.
  const onScrub = driven
    ? (t: number) => setPinnedAt(t)
    : readOnly
      ? undefined
      : (t: number) => configure({ seek: t });
  const onFollow = () => setPinnedAt(null);

  const shared = {
    view,
    cursor,
    pinned,
    readOnly,
    configure: readOnly ? () => {} : configure,
    onScrub,
    onFollow,
  };

  return (
    <>
      <TimelinePanel {...shared} onExpand={() => setExpanded(true)} />
      <CustomDialog
        title={readOnly ? "Timeline (read-only)" : "Timeline"}
        isOpen={expanded}
        onOpenChange={setExpanded}
      >
        <TimelineEditor {...shared} />
      </CustomDialog>
    </>
  );
}
