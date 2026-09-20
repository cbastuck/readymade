import { ServiceInstance, ServiceUIComponent } from "hkp-frontend/src/types";
import Select from "hkp-frontend/src/ui-components/Select";
import NamedPipelinesPanel, {
  NamedPipeline,
  PipelineEntry,
} from "./NamedPipelinesPanel";
import type { ServiceLookup } from "../rest/UIRegistry";

/**
 * A panel per track, and one for the reducer.
 *
 * The service's subject is that several pipelines run over one input, so the
 * panel's is the same: each track is the pipeline it is, under the name the
 * board gave it, openable and editable like any other. Drawing them is
 * NamedPipelinesPanel's job, which every service with more than one pipeline
 * shares; what belongs here is what is particular to Tracks — whether the
 * tracks may overlap, and the reducer being one of the sections rather than
 * something beside them.
 *
 * Shared by both runtimes that host the service. What differs between them is
 * how an edit travels and which registry a nested service's panel comes from,
 * and both arrive here as props.
 */

export type { PipelineEntry };

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
  const sections: NamedPipeline[] = [
    ...tracks.map((track) => ({
      name: track.name,
      label: track.bypass ? `${track.name} (bypassed)` : track.name,
      pipeline: track.pipeline ?? [],
    })),
    // Always shown, empty or not: with nothing here the answers travel on as an
    // array, and that is worth being able to see and change.
    { name: REDUCE, pipeline: reduce },
  ];

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

      {tracks.length === 0 && (
        <div className="text-xs text-neutral-500">
          No tracks configured — passing everything through.
        </div>
      )}

      <NamedPipelinesPanel
        service={service}
        sections={sections}
        // The first track, so a panel opens on the work rather than on the
        // reducer — which is what is left open when there are no tracks at all.
        defaultOpen={tracks[0]?.name ?? REDUCE}
        findServiceUI={findServiceUI}
        getActualInstance={getActualInstance}
        onEdit={onTrackEdit}
      />
    </div>
  );
}
