/**
 * What is actually on the board right now.
 *
 * A board's services are held as descriptors, and a descriptor carries the
 * state a service was *restored* with. Everything configured since — including
 * a sub-service being given a pipeline — lives in the service itself, and is
 * asked for rather than watched: saving a board reads it back service by
 * service, which is why a nested pipeline built in this session shows up in the
 * overview only after a save and a reload had put it into the descriptors.
 *
 * So the overview asks the same question saving asks, and builds its scene from
 * the answer. One call per top-level service is enough for a pipeline of any
 * depth: a sub-service reports the pipeline it hosts as part of its own
 * configuration, nested pipelines and all.
 */
import {
  RuntimeApiMap,
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
  toCanonicalRuntimeClassType,
} from "hkp-frontend/src/types";

export type ServicesByRuntime = {
  [runtimeId: string]: Array<ServiceDescriptor>;
};

export type BoardShapeSource = {
  runtimes: Array<RuntimeDescriptor>;
  services: ServicesByRuntime;
  scopes: { [runtimeId: string]: RuntimeScope };
  runtimeApis: RuntimeApiMap;
};

export async function readBoardShape({
  runtimes,
  services,
  scopes,
  runtimeApis,
}: BoardShapeSource): Promise<ServicesByRuntime> {
  const entries = await Promise.all(
    runtimes.map(async (runtime) => {
      const runtimeServices = services[runtime.id] ?? [];
      const scope = scopes[runtime.id];
      const api =
        runtimeApis?.[runtime.type] ??
        runtimeApis?.[toCanonicalRuntimeClassType(runtime.type)];

      if (!scope || !api?.getServiceConfig) {
        return [runtime.id, runtimeServices] as const;
      }

      const described = await Promise.all(
        runtimeServices.map(async (service) => {
          try {
            const config = await api.getServiceConfig(scope, service);
            // A service that answers with nothing is not saying it has
            // nothing; what it was restored with is still the best answer.
            if (!config || typeof config !== "object") {
              return service;
            }
            // What a service was configured with, as it reports it. A secret
            // is a reference in that state, so what reaches the screen names
            // the secret rather than showing it.
            return { ...service, state: config };
          } catch {
            // One service that cannot be asked — a runtime going away
            // mid-read — costs its own detail, not the rest of the board.
            return service;
          }
        }),
      );

      return [runtime.id, described] as const;
    }),
  );

  return Object.fromEntries(entries);
}
