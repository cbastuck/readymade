import { useState } from "react";
import { ChevronDown, ChevronRight, Maximize2 } from "lucide-react";

import { ServiceInstance, ServiceUIComponent } from "hkp-frontend/src/types";
import SubServicePipelineUI from "./SubServicePipelineUI";
import {
  useInlineHops,
  useLevelDepth,
  useNestedNavigation,
} from "./NestedNavigation";
import type { ServiceLookup } from "../rest/UIRegistry";

/**
 * A service's pipelines, one section each, under the names the service gives
 * them.
 *
 * The generic editor draws the single `pipeline` every nested host used to
 * have. A service with several — a track per branch, an entry point per side —
 * reports none of them under that name, so the generic editor finds nothing and
 * draws an empty container, and the work inside is unreachable. This is that
 * editor once per named pipeline.
 *
 * **The name is the fold.** A reader opens one thing to see a pipeline, not a
 * pipeline and then its contents, so the strip below draws no fold of its own
 * (see SubServicePipelineUI's `collapsed`). Untouched, one section is open:
 * a panel showing nothing but a list of names says nothing about what the
 * service does.
 *
 * Shared by every runtime that hosts such a service. What differs between them
 * is how an edit travels and which registry a nested service's panel comes
 * from, and both arrive here as props.
 */

export type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: any;
};

export type NamedPipeline = {
  /** What an edit names when it is aimed at this pipeline. */
  name: string;
  /** What the reader sees, where that is not simply the name. */
  label?: string;
  pipeline: PipelineEntry[];
};

type Props = {
  service: ServiceInstance;
  sections: NamedPipeline[];
  /**
   * Which section is open before a reader has touched anything. Absent, the
   * first one is.
   */
  defaultOpen?: string;
  findServiceUI: (service: string | ServiceLookup) => ServiceUIComponent | null;
  /** The live instance behind a nested entry, where the host has one. */
  getActualInstance?: (instanceId: string) => ServiceInstance | null;
  /** A pipeline edit, already aimed at one of the sections by name. */
  onEdit: (name: string, payload: Record<string, unknown>) => void;
};

/** The uuid a section's proxy answers to, and the level it opens under. */
export function pipelineProxyUuid(serviceUuid: string, name: string): string {
  return `${serviceUuid}-pipeline-${name}`;
}

export default function NamedPipelinesPanel({
  service,
  sections,
  defaultOpen,
  findServiceUI,
  getActualInstance,
  onEdit,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Opening a pipeline on a level of its own is done from its own row, beside
  // the fold: the strip below draws no chrome here, so a button left to it
  // would sit alone on a row that says nothing else.
  const navigation = useNestedNavigation();
  const depth = useLevelDepth();
  const inlineHops = useInlineHops();

  const openByDefault = defaultOpen ?? sections[0]?.name;

  // Each section as a service whose `pipeline` state and configure() speak
  // SubServicePipelineUI's protocol, translated into section-scoped edits.
  const proxy = (
    name: string,
    label: string,
    pipeline: PipelineEntry[],
  ): ServiceInstance =>
    ({
      uuid: pipelineProxyUuid(service.uuid, name),
      serviceId: service.serviceId,
      serviceName: label,
      state: { pipeline },
      app: service.app,
      board: service.board,
      configure: async (config: any) => onEdit(name, config),
      process: async () => {},
      getConfiguration: async () => ({ pipeline }),
      destroy: async () => {},
    }) as unknown as ServiceInstance;

  return (
    <>
      {sections.map(({ name, label, pipeline }) => {
        const title = label ?? name;
        const shown = open[name] ?? name === openByDefault;
        // The trail names the service as well as the pipeline: which pipeline
        // this is means nothing without the service it belongs to.
        const levelLabel = `${service.serviceName} · ${title}`;
        const entries = pipeline ?? [];
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
                <span className="font-mono whitespace-nowrap">{title}</span>
                <span className="text-neutral-500">
                  {entries.length === 1
                    ? "1 service"
                    : `${entries.length} services`}
                </span>
              </button>

              {navigation && shown && (
                <button
                  className="hkp-svc-btn hkp-svc-btn--icon flex items-center"
                  onClick={() =>
                    navigation.open(
                      pipelineProxyUuid(service.uuid, name),
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
                service={proxy(name, title, entries)}
                findServiceUI={findServiceUI}
                getActualInstance={getActualInstance}
                // The name above is the fold, so the strip draws none of its own.
                collapsed={!shown}
                levelLabel={levelLabel}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
