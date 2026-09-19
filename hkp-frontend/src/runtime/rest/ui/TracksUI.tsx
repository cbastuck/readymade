import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import TracksPanel, {
  PipelineEntry,
  TrackState,
} from "../../ui/TracksPanel";
import { findServiceUI } from "../UIRegistry";

/**
 * The Tracks panel, for a service on another runtime.
 *
 * The service holds one pipeline per track rather than the single `pipeline`
 * every other nested host has, so the generic editor draws it as an empty
 * container: it looks for a property that is not there. Everything drawn here
 * is `TracksPanel`'s; what belongs to this side is that an edit is a request —
 * so the state is **read back** after each one rather than assumed, since what
 * the far end made of it is the only version that counts.
 */
export default function TracksUI(props: ServiceUIProps) {
  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [reduce, setReduce] = useState<PipelineEntry[]>([]);
  const [run, setRun] = useState<"serial" | "parallel">("serial");

  const { service } = props;

  const read = useCallback((state: any) => {
    if (Array.isArray(state?.tracks)) {
      setTracks(state.tracks);
    }
    if (Array.isArray(state?.reduce)) {
      setReduce(state.reduce);
    }
    if (state?.run === "serial" || state?.run === "parallel") {
      setRun(state.run);
    }
  }, []);

  const edit = useCallback(
    async (payload: object) => {
      await service.configure(payload);
      read(await service.getConfiguration?.());
    },
    [service, read],
  );

  return (
    <RuntimeRestServiceUI
      {...props}
      onInit={read}
      onNotification={read}
      genericUI={false}
      initialSize={{ width: 420, height: undefined }}
    >
      <TracksPanel
        service={service}
        tracks={tracks}
        reduce={reduce}
        run={run}
        findServiceUI={findServiceUI}
        onRun={(value) => {
          // Shown at once, then confirmed by what the far end reports: a
          // setting that waits for a round trip feels broken.
          setRun(value);
          void edit({ run: value });
        }}
        onTrackEdit={(track, payload) => void edit({ ...payload, track })}
      />
    </RuntimeRestServiceUI>
  );
}
