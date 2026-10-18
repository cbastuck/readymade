import type { BoardDiagnostic, BoardValidationResult, RuntimeName } from "./types.js";
import { canonicalServiceId, normalizeRuntime } from "./types.js";

export interface ValidationCatalog {
  buildVersion: string;
  commit: string;
  indexedAt: string;
  hasService(serviceId: string, runtime?: RuntimeName): boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferRuntime(runtime: Record<string, unknown>): RuntimeName | undefined {
  if (runtime.type === "browser") return "browser";
  return normalizeRuntime(`${runtime.name ?? ""} ${runtime.id ?? ""} ${runtime.url ?? ""}`);
}

export function validateBoard(board: unknown, catalog: ValidationCatalog): BoardValidationResult {
  const diagnostics: BoardDiagnostic[] = [];
  let checkedServices = 0;
  const add = (diagnostic: BoardDiagnostic) => diagnostics.push(diagnostic);
  if (!record(board)) {
    add({ severity: "error", code: "board.type", path: "$", message: "Board must be a JSON object." });
    return result();
  }
  if (!Array.isArray(board.runtimes)) {
    add({ severity: "error", code: "runtimes.type", path: "$.runtimes", message: "runtimes must be an array." });
  }
  if (!record(board.services)) {
    add({ severity: "error", code: "services.type", path: "$.services", message: "services must be an object keyed by runtime id." });
  }

  const runtimeIds = new Set<string>();
  for (const [index, rawRuntime] of (Array.isArray(board.runtimes) ? board.runtimes : []).entries()) {
    const runtimePath = `$.runtimes[${index}]`;
    if (!record(rawRuntime) || typeof rawRuntime.id !== "string" || !rawRuntime.id.trim()) {
      add({ severity: "error", code: "runtime.id", path: `${runtimePath}.id`, message: "Each runtime needs a non-empty string id." });
      continue;
    }
    const runtimeId = rawRuntime.id;
    if (runtimeIds.has(runtimeId)) {
      add({ severity: "error", code: "runtime.duplicate", path: `${runtimePath}.id`, message: `Duplicate runtime id '${runtimeId}'.` });
    }
    runtimeIds.add(runtimeId);
    const pipeline = record(board.services) ? board.services[runtimeId] : undefined;
    if (!Array.isArray(pipeline)) {
      add({ severity: "error", code: "pipeline.missing", path: `$.services.${runtimeId}`, message: `Runtime '${runtimeId}' needs a matching services array.` });
      continue;
    }
    const runtime = inferRuntime(rawRuntime);
    const instanceIds = new Set<string>();
    for (const [serviceIndex, rawService] of pipeline.entries()) {
      const servicePath = `$.services.${runtimeId}[${serviceIndex}]`;
      checkedServices += 1;
      if (!record(rawService) || typeof rawService.serviceId !== "string" || !rawService.serviceId.trim()) {
        add({ severity: "error", code: "service.id", path: `${servicePath}.serviceId`, message: "Each service needs a non-empty string serviceId.", runtime });
        continue;
      }
      const serviceId = rawService.serviceId;
      const instanceId = typeof rawService.uuid === "string" ? rawService.uuid : typeof rawService.instanceId === "string" ? rawService.instanceId : undefined;
      if (!instanceId) {
        add({ severity: "error", code: "service.instance", path: servicePath, message: "Each top-level service needs a uuid (nested services use instanceId).", serviceId, runtime });
      } else if (instanceIds.has(instanceId)) {
        add({ severity: "error", code: "service.duplicate", path: servicePath, message: `Duplicate service instance id '${instanceId}' in runtime '${runtimeId}'.`, serviceId, runtime });
      } else {
        instanceIds.add(instanceId);
      }
      if (rawService.state !== undefined && !record(rawService.state)) {
        add({ severity: "error", code: "service.state", path: `${servicePath}.state`, message: "Service state must be a JSON object when present.", serviceId, runtime });
      }
      if (!catalog.hasService(canonicalServiceId(serviceId), runtime)) {
        add({
          severity: "warning",
          code: "service.unknown",
          path: `${servicePath}.serviceId`,
          message: runtime
            ? `No indexed ${runtime} contract was found for '${serviceId}'. Confirm it against the connected runtime registry.`
            : `No indexed contract was found for '${serviceId}'. Confirm it against the connected runtime registry.`,
          serviceId,
          runtime,
        });
      }
    }
  }
  if (record(board.services)) {
    for (const key of Object.keys(board.services)) {
      if (!runtimeIds.has(key)) {
        add({ severity: "error", code: "pipeline.orphan", path: `$.services.${key}`, message: `Services key '${key}' has no matching runtime.` });
      }
    }
  }
  return result();

  function result(): BoardValidationResult {
    return {
      valid: !diagnostics.some((entry) => entry.severity === "error"),
      mode: "static",
      diagnostics,
      checkedServices,
      provenance: {
        repository: "readymade",
        commit: catalog.commit,
        buildVersion: catalog.buildVersion,
        exactBuildMatch: true,
        indexedAt: catalog.indexedAt,
      },
    };
  }
}
