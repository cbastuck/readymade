import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Select from "hkp-frontend/src/ui-components/Select";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";

/**
 * A panel per track, and one for the reducer.
 *
 * The service's subject is that several pipelines run over one input, so the
 * panel's subject is the same: each track is shown as the pipeline it is,
 * openable and editable like any other, under the name the board gave it. What
 * a single-pipeline service shows once, this shows once per track.
 */

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: any;
};

type Track = {
  name: string;
  bypass?: boolean;
  pipeline: PipelineEntry[];
};

/** The name the reducer answers to when an edit names a branch. */
const REDUCE = "reduce";

export default function TracksUI(props: ServiceUIProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [reduce, setReduce] = useState<PipelineEntry[]>([]);
  const [run, setRun] = useState<"serial" | "parallel">("serial");
  // Bumped when a scope finishes rebuilding, so the pipelines below pick up
  // the instances that now exist.
  const [, setScopeVersion] = useState(0);
  // Which tracks a reader has opened or shut. The name is the control, so a
  // reader opens one thing to see a track rather than a track and then its
  // pipeline. Untouched, the first track is open: a panel that shows nothing
  // but a list of names says nothing about what the service does, and the
  // first track is the one a board's author wrote first.
  const [open, setOpen] = useState<Record<string, boolean>>({});

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

  const onInit = (initialState: any) => read(initialState);

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

  // Each track as a service whose `pipeline` state and configure() speak
  // SubServicePipelineUI's protocol, translated into track-scoped configure
  // calls on the Tracks service.
  const trackProxy = (
    name: string,
    label: string,
    pipeline: PipelineEntry[],
  ): ServiceInstance =>
    ({
      uuid: `${service.uuid}-track-${name}`,
      serviceId: "tracks",
      serviceName: label,
      state: { pipeline },
      app: service.app,
      board: service.board,
      configure: async (config: any) => service.configure({ ...config, track: name }),
      process: async () => {},
      getConfiguration: async () => ({ pipeline }),
      destroy: async () => {},
    }) as unknown as ServiceInstance;

  const section = (name: string, label: string, pipeline: PipelineEntry[]) => {
    const shown = open[name] ?? name === tracks[0]?.name;
    return (
      <div key={name} className="flex flex-col gap-1">
        <button
          className="hkp-svc-btn flex items-center gap-1 text-xs w-fit"
          aria-expanded={shown}
          onClick={() => setOpen((prev) => ({ ...prev, [name]: !shown }))}
        >
          {shown ? (
            <ChevronDown size={14} strokeWidth={1.5} />
          ) : (
            <ChevronRight size={14} strokeWidth={1.5} />
          )}
          <span className="font-mono whitespace-nowrap">{label}</span>
          <span className="text-neutral-500">
            {pipeline.length === 1 ? "1 service" : `${pipeline.length} services`}
          </span>
        </button>
        <div className="pl-4">
          <SubServicePipelineUI
            service={trackProxy(name, label, pipeline)}
            findServiceUI={findServiceUI}
            getActualInstance={getActualInstance}
            // The name above is the fold, so the strip draws none of its own.
            collapsed={!shown}
            // The trail names the service as well as the track: which track
            // this is means nothing without the service it is a track of.
            levelLabel={`${service.serviceName} · ${label}`}
          />
        </div>
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: 260 }}>
        <div className="flex items-center gap-2 text-xs">
          {/* One at a time, or all at once. The words are the setting's own:
              a board author choosing here is choosing whether tracks may
              overlap, not naming an execution model. */}
          <span className="text-neutral-500">run</span>
          <Select
            title="run"
            value={run}
            options={["serial", "parallel"]}
            onChange={(value: string) => {
              setRun(value as "serial" | "parallel");
              service.configure({ run: value });
            }}
          />
        </div>

        {tracks.length === 0 ? (
          <div className="text-xs text-neutral-500">
            No tracks configured — passing everything through.
          </div>
        ) : (
          tracks.map((track) =>
            section(
              track.name,
              track.bypass ? `${track.name} (bypassed)` : track.name,
              track.pipeline ?? [],
            ),
          )
        )}

        {/* Always shown, empty or not: with nothing here the answers travel on
            as an array, and that is worth being able to see and change. */}
        {section(REDUCE, REDUCE, reduce)}
      </div>
    </ServiceUI>
  );
}
