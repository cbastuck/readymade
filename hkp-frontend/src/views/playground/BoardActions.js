import * as uuid from "uuid";

import { replacePlaceholders } from "../../core/url";

export async function importBoard(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    const runtimeIds = Object.keys(data);
    return {
      runtimes: runtimeIds.map((rid, ridx) => ({
        id: rid,
        type: data[rid].type,
        name: data[rid].name || `Runtime ${ridx + 1}`,
      })),
      services: runtimeIds.reduce(
        (all, rid) => ({
          ...all,
          [rid]: data[rid].services.map((svc) => {
            if (!svc.uuid) {
              return { ...svc, uuid: uuid.v4() };
            }
            return svc;
          }),
        }),
        {}
      ),
    };
  } catch (err) {
    console.log("Import failed", err, url);
  }
}

export async function createBoardFromTemplate(templateUrl, params) {
  const resp = await fetch(templateUrl);
  if (resp && resp.ok) {
    try {
      const template = await resp.json();
      const {
        runtimes,
        services,
        sidechainRouting,
        description,
        inputRouting,
        outputRouting,
      } = template;
      const patchedRuntimes = runtimes.map((rt) => ({
        ...rt,
        id: uuid.v4(),
      }));
      const patchedServices = patchedRuntimes.reduce(
        (all, rt, idx) => ({
          ...all,
          [rt.id]: services[runtimes[idx].id].map((svc) => ({
            uuid: uuid.v4(),
            ...svc,
          })),
        }),
        {}
      );
      return {
        runtimes: patchedRuntimes,
        services: patchedServices,
        sidechainRouting: sidechainRouting
          ? patchedRuntimes.reduce((all, rt, idx) => {
              const originalRt = runtimes[idx];
              const originalRuntimeSidechain =
                sidechainRouting[originalRt.id] || [];
              const patchedRuntimeSidechain = originalRuntimeSidechain.map(
                (entry) => {
                  const origRTIndex = runtimes.findIndex(
                    (r) => r.id === entry.runtimeId
                  );
                  if (origRTIndex === -1) {
                    console.error(
                      "createBoardFromTemplate(): could not find runtime",
                      entry,
                      runtimes
                    );
                  }
                  const origSvcIndex = services[entry.runtimeId].findIndex(
                    (svc) => svc.uuid === entry.serviceUuid
                  );
                  if (origSvcIndex === -1) {
                    console.error(
                      "createBoardFromTemplate(): could not find service",
                      entry,
                      services[originalRt.id]
                    );
                  }
                  const patchedRuntimeId = patchedRuntimes[origRTIndex].id;
                  return {
                    runtimeId: patchedRuntimeId,
                    serviceUuid:
                      patchedServices[patchedRuntimeId][origSvcIndex].uuid,
                  };
                }
              );
              return {
                ...all,
                [rt.id]: patchedRuntimeSidechain,
              };
            }, {})
          : {},
        inputRouting: inputRouting
          ? patchedRuntimes.reduce(
              (all, rt, idx) => ({
                ...all,
                [rt.id]: replacePlaceholders(
                  inputRouting[runtimes[idx].id],
                  params
                ),
              }),
              {}
            )
          : undefined,
        outputRouting: outputRouting
          ? patchedRuntimes.reduce((all, rt, idx) => {
              const routing = outputRouting[runtimes[idx].id];
              return routing
                ? {
                    ...all,
                    [rt.id]: {
                      ...routing,
                      peer: replacePlaceholders(routing.peer, params),
                    },
                  }
                : all;
            }, {})
          : undefined,
        description,
      };
    } catch (err) {
      console.error("Creating from template failed", templateUrl, err);
    }
  }
}

export function reorderService(
  allServices,
  runtime,
  serviceUuid,
  targetPosition
) {
  const services = allServices[runtime.id];
  const service = services.find((svc) => serviceUuid === svc.uuid);
  const fromIndex = services.indexOf(service);
  const toIndex =
    targetPosition > fromIndex
      ? Math.max(targetPosition - 1, 0)
      : targetPosition;

  const newArr = [...services];
  newArr.splice(fromIndex, 1);
  newArr.splice(toIndex, 0, services[fromIndex]);
  return newArr;
}

export function renameRuntime(runtimes, runtimeId, newName) {
  return runtimes.map((rt) =>
    rt.id === runtimeId ? { ...rt, name: newName } : rt
  );
}
