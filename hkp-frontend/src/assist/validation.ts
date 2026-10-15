import { BoardDescriptor } from "../types";

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Structural checks before offering model output to the board loader. State
 * contracts remain service-specific and are supplied by the documentation. */
export function validateAssistBoard(value: unknown): BoardDescriptor {
  if (
    !object(value) ||
    !Array.isArray(value.runtimes) ||
    !object(value.services)
  ) {
    throw new Error("The proposed board needs runtimes and a services map.");
  }
  const ids = new Set<string>();
  for (const rt of value.runtimes) {
    if (
      !object(rt) ||
      typeof rt.id !== "string" ||
      !rt.id ||
      typeof rt.name !== "string" ||
      !["browser", "rest", "graphql", "realtime", "remote"].includes(
        String(rt.type),
      )
    ) {
      throw new Error(
        "Each runtime needs a unique id, name and supported type.",
      );
    }
    if (ids.has(rt.id)) throw new Error(`Duplicate runtime id: ${rt.id}`);
    ids.add(rt.id);
    if (rt.type !== "browser" && !!rt.url === !!rt.remote) {
      throw new Error(`Runtime ${rt.id} needs exactly one URL or remote name.`);
    }
    if (!Array.isArray(value.services[rt.id]))
      throw new Error(`Missing service list for ${rt.id}.`);
    validatePipeline(value.services[rt.id] as unknown[], true);
  }
  for (const id of Object.keys(value.services)) {
    if (!ids.has(id))
      throw new Error(`Services reference unknown runtime: ${id}`);
  }
  if (value.boardName !== undefined && typeof value.boardName !== "string")
    throw new Error("Board name must be text.");
  return value as BoardDescriptor;
}
function validatePipeline(entries: unknown[], topLevel: boolean) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (
      !object(entry) ||
      (typeof entry.serviceId !== "string" && typeof entry.block !== "string")
    ) {
      throw new Error("Each service needs a serviceId or block reference.");
    }
    const id = topLevel ? entry.uuid : entry.instanceId;
    if (typeof id !== "string" || !id || ids.has(id))
      throw new Error(
        "Service identifiers must be present and unique within a pipeline.",
      );
    ids.add(id);
    if (entry.state !== undefined && !object(entry.state))
      throw new Error(`Invalid state for ${id}.`);
    const state = entry.state;
    if (object(state)) {
      if (state.pipeline !== undefined) {
        if (!Array.isArray(state.pipeline))
          throw new Error(`Invalid pipeline for ${id}.`);
        validatePipeline(state.pipeline, false);
      }
      if (Array.isArray(state.cases))
        for (const branch of state.cases) {
          if (object(branch) && Array.isArray(branch.pipeline))
            validatePipeline(branch.pipeline, false);
        }
      if (Array.isArray(state.default)) validatePipeline(state.default, false);
    }
  }
}
