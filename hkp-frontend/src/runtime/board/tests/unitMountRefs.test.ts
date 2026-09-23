import { describe, expect, it } from "vitest";

import { parseMountRef } from "../mount";
import { UNIT_SEPARATOR, UnitBoard, unitNameOf } from "../units";

/**
 * Every mount reference a composition writes into a unit, checked against the
 * unit it names.
 *
 * A reference is resolved at load time against a service that has to be there,
 * and a reference to one that is not resolves to nothing at all — so the unit
 * runs with the literal `hkp-mount://…` in the field it was meant to fill, and
 * fails wherever it first dials it. Nothing between the two boards says they
 * disagree: the composition names a service in a document it does not contain.
 *
 * What moves an address is a change inside the unit — nesting an endpoint in a
 * scope renames it, because a scoped service is named by the path through the
 * services containing it. That is a change to one board breaking another, which
 * is what this test is here to catch.
 */

const boards = import.meta.glob("../../../../boards/*.json", {
  eager: true,
  import: "default",
}) as Record<string, UnitBoard>;

/** The board documents by file name, as a composition's `uri` names them. */
const byFileName = new Map(
  Object.entries(boards).map(([path, board]) => [
    path.split("/").at(-1) as string,
    board,
  ]),
);

const compositions = [...byFileName.entries()].filter(
  ([, board]) => (board.units?.length ?? 0) > 0,
);

type Entry = { uuid?: string; instanceId?: string; state?: unknown };

/**
 * Every address a runtime answers to: the services a board lists, and the ones
 * they contain, by the path through them.
 *
 * Found by the shape of an entry rather than by the field a container keeps its
 * pipeline in, for the reason `resolveNestedState` gives: a scope calls it
 * `pipeline`, an endpoint has `onProcess` and `onRequest`, Tracks one per
 * track, and the next container will call it something else again.
 */
function addressesIn(services: Entry[] | undefined, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of services ?? []) {
    const name = entry.uuid ?? entry.instanceId;
    if (!name) {
      continue;
    }
    const address = prefix ? `${prefix}${UNIT_SEPARATOR}${name}` : name;
    found.push(address, ...addressesIn(nestedIn(entry.state), address));
  }
  return found;
}

/** The service entries filed anywhere in a state, at any depth. */
function nestedIn(state: unknown): Entry[] {
  if (Array.isArray(state)) {
    return state.flatMap((item) =>
      isEntry(item) ? [item] : nestedIn(item),
    );
  }
  if (!state || typeof state !== "object") {
    return [];
  }
  return Object.values(state as Record<string, unknown>).flatMap(nestedIn);
}

function isEntry(value: unknown): value is Entry {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).serviceId === "string"
  );
}

describe.each(compositions)("%s", (_fileName, composition) => {
  const units = composition.units ?? [];

  it("points every mount reference at a service its unit declares", () => {
    // Which unit a runtime id belongs to is the prefix a composition gave it,
    // so a reference is checked against the document that unit was read from
    // rather than against the composition, which lists no services of its own.
    const unresolved: string[] = [];

    for (const entry of units) {
      for (const value of Object.values(entry.params ?? {})) {
        const ref = parseMountRef(value);
        if (!ref) {
          continue;
        }
        const separator = ref.runtimeId.indexOf(UNIT_SEPARATOR);
        if (separator <= 0) {
          continue; // A runtime of the composition itself, not of a unit.
        }
        const unitName = ref.runtimeId.slice(0, separator);
        const runtimeId = ref.runtimeId.slice(separator + 1);

        const target = units.find(
          (candidate) =>
            unitNameOf(
              candidate,
              byFileName.get(candidate.uri) ?? ({} as UnitBoard),
            ) === unitName,
        );
        const board = target && byFileName.get(target.uri);
        if (!board) {
          unresolved.push(`${value} — no unit called '${unitName}'`);
          continue;
        }

        const addresses = addressesIn(
          board.services?.[runtimeId] as Entry[] | undefined,
        );
        if (!addresses.includes(ref.serviceUuid)) {
          // Naming the near miss, because the usual cause is a service that
          // moved into a scope and kept its own name.
          const moved = addresses.filter((address) =>
            address.endsWith(`${UNIT_SEPARATOR}${ref.serviceUuid}`),
          );
          unresolved.push(
            `${value} — ${target.uri} has no '${ref.serviceUuid}' in '${runtimeId}'` +
              (moved.length ? `; did you mean '${moved.join("', '")}'?` : ""),
          );
        }
      }
    }

    expect(unresolved).toEqual([]);
  });
});
