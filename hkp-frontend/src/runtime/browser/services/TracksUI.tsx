import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import TracksPanel, {
  PipelineEntry,
  TrackState,
} from "../../ui/TracksPanel";
import { findServiceUI } from "../UIRegistry";

/**
 * The Tracks panel, in the runtime that hosts the service in this process.
 *
 * Everything drawn is `TracksPanel`'s; what belongs here is how an edit reaches
 * the service — a direct call — and where a nested service's live instance
 * comes from, which is the thing a browser runtime has and a remote one does
 * not.
 */
export default function TracksUI(props: ServiceUIProps) {
  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [reduce, setReduce] = useState<PipelineEntry[]>([]);
  const [run, setRun] = useState<"serial" | "parallel">("serial");
  // Bumped when a scope finishes rebuilding, so the pipelines below pick up
  // the instances that now exist.
  const [, setScopeVersion] = useState(0);

  const read = (state: any) => {
    if (Array.isArray(state?.tracks)) {
      setTracks(state.tracks);
    }
    if (Array.isArray(state?.reduce)) {
      setReduce(state.reduce);
    }
    if (state?.run === "serial" || state?.run === "parallel") {
      setRun(state.run);
    }
  };

  const onNotification = useCallback((notification: any) => {
    read(notification);
    if (notification?.__innerScopeReady) {
      setScopeVersion((v) => v + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as any;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.service],
  );

  const { service } = props;

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={read}
      onNotification={onNotification}
    >
      <TracksPanel
        service={service}
        tracks={tracks}
        reduce={reduce}
        run={run}
        findServiceUI={findServiceUI}
        getActualInstance={getActualInstance}
        onRun={(value) => {
          setRun(value);
          service.configure({ run: value });
        }}
        onTrackEdit={(track, payload) =>
          service.configure({ ...payload, track })
        }
      />
    </ServiceUI>
  );
}
