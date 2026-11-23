import { BoardDescriptor } from "../types";
import { FACADE_PROBLEMS_SHOWN, facadeProblems } from "../facade/validateFacade";
import { FACADE_TYPES, facadeTypePath } from "./documentation";

/** A facade problem as it reads wherever its widget sits. */
const unplaced = (problem: string) => problem.replace(/\[\d+\]/g, "[]");

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Structural checks before offering model output to the board loader. State
 * contracts remain service-specific and are supplied by the documentation.
 *
 * The facade is checked against its schema. Given the board it would replace,
 * only what the proposal adds is held against it: a facade that was already
 * off does not block every change to the board around it. */
export function validateAssistBoard(
  value: unknown,
  base?: BoardDescriptor,
): BoardDescriptor {
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
  if (value.facade !== undefined) {
    // Counted by what each problem says with its positions left out, so one
    // the board already had is still known after a panel or widget is added
    // ahead of it — and one more of the same kind still counts as added.
    const known = new Map<string, number>();
    if (base?.facade)
      for (const problem of facadeProblems(base.facade, { limit: Infinity })) {
        const key = unplaced(problem);
        known.set(key, (known.get(key) ?? 0) + 1);
      }
    // All of them, before any is held back: the first few could all be old.
    const added = facadeProblems(value.facade, { limit: Infinity })
      .filter((problem) => {
        const key = unplaced(problem);
        const left = known.get(key) ?? 0;
        if (left) known.set(key, left - 1);
        return !left;
      })
      .slice(0, FACADE_PROBLEMS_SHOWN);
    if (added.length) {
      // The shape of each type a problem names, to read rather than the
      // whole schema: the innermost `(type)` is where the problem is. A wrong
      // number, boolean or null is shown in parentheses too, after the type,
      // so the innermost one that names a type counts.
      const parts = [
        ...new Set(
          added
            .map((problem) =>
              [...problem.matchAll(/\(([\w-]+)\)/g)]
                .map((match) => facadeTypePath(match[1]))
                .filter((path): path is string => !!path)
                .pop(),
            )
            .filter((path): path is string => !!path),
        ),
      ];
      throw new Error(
        `The facade does not match its schema (${FACADE_TYPES}):\n- ${added.join("\n- ")}${
          parts.length ? `\nRead the shapes it names: ${parts.join(", ")}.` : ""
        }`,
      );
    }
  }
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
