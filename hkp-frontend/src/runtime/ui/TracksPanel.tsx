import { useState } from "react";
import { ChevronDown, ChevronRight, Maximize2 } from "lucide-react";

import { ServiceInstance, ServiceUIComponent } from "hkp-frontend/src/types";
import Select from "hkp-frontend/src/ui-components/Select";
import SubServicePipelineUI from "./SubServicePipelineUI";
import {
  useInlineHops,
  useLevelDepth,
  useNestedNavigation,
} from "./NestedNavigation";
import type { ServiceLookup } from "../rest/UIRegistry";

/**
 * A panel per track, and one for the reducer.
 *
 * The service's subject is that several pipelines run over one input, so the
 * panel's is the same: each track is the pipeline it is, under the name the
 * board gave it, openable and editable like any other. What a single-pipeline
 * service shows once, this shows once per track — which is why the generic
 * editor cannot draw it: there is no `pipeline` to find, and a service with
 * three of them drawn as none is a board whose work is unreachable.
 *
 * Shared by both runtimes that host the service. What differs between them is
 * how an edit travels and which registry a nested service's panel comes from,
 * and both arrive here as props.
 */

export type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: any;
};

export type TrackState = {
  name: string;
  bypass?: boolean;
  pipeline: PipelineEntry[];
};

/** The name the reducer answers to when an edit names a branch. */
export const REDUCE = "reduce";

type Props = {
  service: ServiceInstance;
  tracks: TrackState[];
  reduce: PipelineEntry[];
  run: "serial" | "parallel";
  findServiceUI: (service: string | ServiceLookup) => ServiceUIComponent | null;
  /** The live instance behind a nested entry, where the host has one. */
  getActualInstance?: (instanceId: string) => ServiceInstance | null;
  onRun: (run: "serial" | "parallel") => void;
  /** A pipeline edit, already aimed at one track — or at the reducer. */
  onTrackEdit: (track: string, payload: Record<string, unknown>) => void;
};

export default function TracksPanel({
  service,
  tracks,
  reduce,
  run,
  findServiceUI,
  getActualInstance,
  onRun,
  onTrackEdit,
}: Props) {
  // Which tracks a reader has opened or shut. The name is the control, so a
  // reader opens one thing to see a track rather than a track and then its
  // pipeline. Untouched, the first track is open: a panel showing nothing but
  // a list of names says nothing about what the service does.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Opening a track on a level of its own is done from the track's own row,
  // beside the fold: the pipeline inside it draws no chrome here, so a button
  // left to it would sit alone on a row that says nothing else.
  const navigation = useNestedNavigation();
  const depth = useLevelDepth();
  const inlineHops = useInlineHops();

  // Each track as a service whose `pipeline` state and configure() speak
  // SubServicePipelineUI's protocol, translated into track-scoped edits.
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
      configure: async (config: any) => onTrackEdit(name, config),
      process: async () => {},
      getConfiguration: async () => ({ pipeline }),
      destroy: async () => {},
    }) as unknown as ServiceInstance;

  const section = (name: string, label: string, pipeline: PipelineEntry[]) => {
    const shown = open[name] ?? name === tracks[0]?.name;
    const levelLabel = `${service.serviceName} · ${label}`;
    return (
      <div key={name} className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 text-xs w-fit"
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
              {pipeline.length === 1
                ? "1 service"
                : `${pipeline.length} services`}
            </span>
          </button>

          {navigation && shown && (
            <button
              className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
              onClick={() =>
                navigation.open(
                  `${service.uuid}-track-${name}`,
                  levelLabel,
                  depth,
                  inlineHops > 0,
                )
              }
              aria-label={`Open ${levelLabel} as its own level`}
              title={`Open ${levelLabel} as its own level`}
            >
              <Maximize2 size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div className="pl-4">
          <SubServicePipelineUI
            service={trackProxy(name, label, pipeline)}
            findServiceUI={findServiceUI}
            getActualInstance={getActualInstance}
            // The name above is the fold, so the strip draws none of its own.
            collapsed={!shown}
            // The trail names the service as well as the track: which track
            // this is means nothing without the service it is a track of.
            levelLabel={levelLabel}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" style={{ minWidth: 260 }}>
      <div className="flex items-center gap-2 text-xs">
        {/* One at a time, or all at once. The words are the setting's own: a
            board author choosing here is choosing whether tracks may overlap,
            not naming an execution model. */}
        <span className="text-neutral-500">run</span>
        <Select
          title="run"
          value={run}
          options={["serial", "parallel"]}
          onChange={(value: string) => onRun(value as "serial" | "parallel")}
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
  );
}
