import type { BoardContextState } from "../BoardContext";

export type AssistPromptContext = Pick<
  BoardContextState,
  "runtimes" | "services" | "registry" | "availableRuntimeEngines"
>;

export type AssistPromptCompletion = {
  category: "runtime" | "runtime-type" | "service" | "service-type";
  label: string;
  detail: string;
  filterText: string;
  insertText: string;
  sortText: string;
};

export function buildAssistPromptCompletions(
  board: AssistPromptContext | null,
): AssistPromptCompletion[] {
  if (!board) return [];

  const completions: AssistPromptCompletion[] = [];
  for (const runtime of board.runtimes) {
    completions.push({
      category: "runtime",
      label: `${runtime.name} (${runtime.id})`,
      detail: `Current runtime · ${runtime.type} · id: ${runtime.id}`,
      filterText: `@runtime ${runtime.name} ${runtime.id} ${runtime.type}`,
      insertText: `@runtime(${runtime.id})`,
      sortText: `1-${runtime.name}-${runtime.id}`,
    });
  }

  for (const [runtimeId, services] of Object.entries(board.services)) {
    for (const service of services) {
      const name = service.serviceName || service.serviceId;
      completions.push({
        category: "service",
        label: `${name} (${service.uuid})`,
        detail: `Current service · ${runtimeId} · ${service.serviceId}`,
        filterText: `@service ${name} ${service.uuid} ${service.serviceId} ${runtimeId}`,
        insertText: `@service(${service.uuid})`,
        sortText: `2-${name}-${service.uuid}`,
      });
    }
  }

  const runtimeTypes = new Set<string>();
  for (const runtime of board.availableRuntimeEngines) {
    const key = `${runtime.type}\u0000${runtime.name}`;
    if (runtimeTypes.has(key)) continue;
    runtimeTypes.add(key);
    completions.push({
      category: "runtime-type",
      label: runtime.name,
      detail: `Available runtime type · ${runtime.type}`,
      filterText: `@runtime-type ${runtime.name} ${runtime.type}`,
      insertText: `@runtime-type(${runtime.name})`,
      sortText: `3-${runtime.name}-${runtime.type}`,
    });
  }

  const serviceTypes = new Map<
    string,
    { serviceName: string; runtimeIds: string[] }
  >();
  for (const [runtimeId, services] of Object.entries(board.registry)) {
    for (const service of services) {
      const known = serviceTypes.get(service.serviceId);
      if (known) {
        if (!known.runtimeIds.includes(runtimeId))
          known.runtimeIds.push(runtimeId);
      } else {
        serviceTypes.set(service.serviceId, {
          serviceName: service.serviceName,
          runtimeIds: [runtimeId],
        });
      }
    }
  }
  for (const [serviceId, service] of serviceTypes) {
    completions.push({
      category: "service-type",
      label: service.serviceName || serviceId,
      detail: `Available service type · ${service.runtimeIds.join(", ")} · ${serviceId}`,
      filterText: `@service-id ${service.serviceName} ${serviceId} ${service.runtimeIds.join(" ")}`,
      insertText: `@service-id(${serviceId})`,
      sortText: `4-${service.serviceName}-${serviceId}`,
    });
  }

  return completions;
}

/** The unfinished @mention immediately before the caret, if there is one. */
export function promptMentionStart(lineBeforeCaret: string): number | null {
  const match = lineBeforeCaret.match(/(^|[\s([{])(@[a-zA-Z0-9._:/-]*)$/);
  if (!match || match.index === undefined) return null;
  return match.index + match[1].length;
}
