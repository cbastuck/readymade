/**
 * What a runtime offers to be added to it: its services, the building blocks
 * kept on this device, and the blocks of the board being built.
 *
 * Read by every palette there is — the desktop sidebar, a card per entry for
 * each class of runtime on the board, and the mobile add-service sheet, for
 * the one runtime it adds to — so a block shows up in both or in neither.
 * Adding an entry is `addService`, which knows what each kind stands for
 * (`core/serviceOperations`).
 */

import {
  RuntimeClassType,
  ServiceClass,
  ServiceClassWithPreset,
  toCanonicalRuntimeClassType,
  toCanonicalServiceId,
} from "../types";
import { BlockDefinition, findSameDefinition } from "../runtime/board/blocks";
import { Preset, isUsableAsBlock, parseBlockDefinition } from "./presets";

/** The service a composed preset is a preset *of*, canonically. */
export const SUB_SERVICE_ID = "sub-service";

/** Distinct per entry: one service can appear once plus once per preset of it. */
export function paletteKey(svc: ServiceClassWithPreset): string {
  if (svc.block) {
    return `block:${svc.block.id}`;
  }
  return svc.preset ? `${svc.serviceId}:${svc.preset.id}` : svc.serviceId;
}

/**
 * The entries a class of runtime offers, in the order a palette shows them:
 * the board's own blocks first, then its services, then the sub-service
 * presets kept on this device.
 *
 * `services` is what the runtime's registry lists; `runtimeType` its class,
 * in any spelling; `subServicePresets` the presets of `sub-service` this
 * device keeps; `boardBlocks` the definitions of the board being opened (a
 * unit's blocks are for its own runtimes).
 */
export function paletteFor(
  services: ServiceClass[],
  runtimeType: string,
  subServicePresets: Preset[],
  boardBlocks: BlockDefinition[],
): ServiceClassWithPreset[] {
  const type = toCanonicalRuntimeClassType(runtimeType as RuntimeClassType);
  const group: ServiceClassWithPreset[] = [];
  for (const svc of services) {
    if (!group.some((s) => s.serviceId === svc.serviceId)) {
      group.push(svc);
    }
  }
  /** The library blocks offered as entries. */
  const offeredFromLibrary: BlockDefinition[] = [];

  // A sub-service preset is a pipeline someone built and kept, which is a
  // building block in exactly the way a primitive is: it belongs in the
  // palette rather than behind a menu on a service you have to add first.
  // Offered only where the runtime has a sub-service to put it in, and only
  // where the preset says it belongs — its nested services are named by ids
  // that one runtime's registry has and another's may not.
  const subServiceHost = group.find(
    (svc) => toCanonicalServiceId(svc.serviceId) === SUB_SERVICE_ID,
  );
  if (subServiceHost) {
    for (const preset of subServicePresets) {
      const use = isUsableAsBlock(preset);
      if (
        preset.runtimes?.length &&
        !preset.runtimes.some(
          (rt) => toCanonicalRuntimeClassType(rt as RuntimeClassType) === type,
        )
      ) {
        continue;
      }
      group.push({
        // The entry is the preset, so it is called what the preset is called.
        // `serviceName` is the name a preset gives a service it is *applied*
        // to, and one captured from a service carries whatever that service
        // was called — "SubService", beside the SubService primitive.
        serviceId: subServiceHost.serviceId,
        serviceName: preset.name,
        description: preset.description,
        version: subServiceHost.version,
        capabilities: subServiceHost.capabilities,
        preset: {
          id: preset.id,
          serviceId: preset.serviceId,
          ...(use ? { use: true } : {}),
        },
      });
      if (use) {
        offeredFromLibrary.push(parseBlockDefinition(preset));
      }
    }
  }

  // The board's own blocks, where the runtime has the service each one is
  // made of.
  for (const definition of boardBlocks) {
    // A copy of a library block the palette already offers stays behind the
    // library's entry, where it was added from — adding that entry uses the
    // board's copy. It gets an entry of its own once it differs.
    if (findSameDefinition(offeredFromLibrary, definition)) {
      continue;
    }
    const host = group.find(
      (svc) =>
        !svc.preset &&
        !svc.block &&
        toCanonicalServiceId(svc.serviceId) ===
          toCanonicalServiceId(definition.serviceId),
    );
    if (!host) {
      continue;
    }
    group.unshift({
      serviceId: host.serviceId,
      serviceName: definition.name,
      description: definition.description,
      version: host.version,
      capabilities: host.capabilities,
      block: { id: definition.id },
    });
  }
  return group;
}
