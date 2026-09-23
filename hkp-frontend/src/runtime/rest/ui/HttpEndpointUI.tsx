import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import NamedPipelinesPanel, {
  NamedPipeline,
  PipelineEntry,
} from "../../ui/NamedPipelinesPanel";
import { findServiceUI } from "../UIRegistry";
import CopyButton from "hkp-frontend/src/ui-components/CopyButton";

/**
 * The endpoint's pipelines, one section per entry point.
 *
 * An endpoint has two ways in — `onRequest` for a caller, `onProcess` for a
 * pass of the board's own chain — and each is a pipeline of its own. The
 * generic editor looks for the single `pipeline` a nested host used to have, so
 * an endpoint that named its entries draws as an empty container and the work
 * inside it is unreachable.
 *
 * A board on the older spelling reports `pipeline` and nothing else, and is
 * shown as the one pipeline it is, under that name. Which sides enter it is its
 * `mode`, which this panel does not offer to change: an endpoint that wants the
 * two sides apart says so by naming them.
 */
export default function HttpEndpointUI(props: ServiceUIProps) {
  const [sections, setSections] = useState<NamedPipeline[]>([]);
  const [address, setAddress] = useState("");

  const { service } = props;

  const read = useCallback((state: any) => {
    if (typeof state !== "object" || state === null) {
      return;
    }
    const found: NamedPipeline[] = [];
    for (const name of ["onProcess", "onRequest"] as const) {
      if (Array.isArray(state[name])) {
        found.push({ name, pipeline: state[name] as PipelineEntry[] });
      }
    }
    // Only where the endpoint named no entries: the two forms are alternatives,
    // and showing a legacy `pipeline` beside them would offer an edit that goes
    // to a pipeline nothing enters.
    if (found.length === 0 && Array.isArray(state.pipeline)) {
      found.push({ name: "pipeline", pipeline: state.pipeline });
    }
    // A report is not always the whole state: a service says what it has to
    // say, and one that has just been given its address says only that. Read
    // per field, so a partial report leaves what it is silent about standing —
    // an endpoint whose pipelines are genuinely gone reports them empty rather
    // than omitting them.
    if (found.length > 0 || carriesPipelines(state)) {
      setSections(found);
    }
    if (typeof state.__hkpMount === "string") {
      setAddress(state.__hkpMount);
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
      <div className="flex flex-col gap-2" style={{ minWidth: 260 }}>
        {address && (
          // What this endpoint is reachable at, which is assigned rather than
          // configured and therefore the one thing here a reader cannot work
          // out from the board.
          <div className="flex items-start gap-1">
            <div className="text-xs text-neutral-500 break-all font-mono flex-1">
              {address}
            </div>
            <CopyButton value={address} label="mount URL" />
          </div>
        )}

        <NamedPipelinesPanel
          service={service}
          sections={sections}
          // The handler, where there is one: what an endpoint does for a caller
          // is what a reader opening it came to see.
          defaultOpen={
            sections.some((section) => section.name === "onRequest")
              ? "onRequest"
              : sections[0]?.name
          }
          findServiceUI={findServiceUI}
          onEdit={(name, payload) =>
            void edit(
              name === "pipeline"
                ? payload
                : { configurePipeline: { ...payload, entry: name } },
            )
          }
        />
      </div>
    </RuntimeRestServiceUI>
  );
}

/** Whether a report says anything about the endpoint's pipelines at all. */
function carriesPipelines(state: Record<string, unknown>): boolean {
  return ["onProcess", "onRequest", "pipeline"].some((name) => name in state);
}
