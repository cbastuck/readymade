/**
 * Blocks, linked into a board and back out of it. The mechanics are in
 * `runtime/board/blocks`; this is where they meet the documents a board is
 * made of — the board being opened and the units placed into it, each with its
 * own definitions.
 */

import { BoardDescriptor, toCanonicalServiceId } from "../types";
import {
  BlockLinkage,
  blockUseContaining,
  collapseBlocks,
  expandBlocks,
} from "../runtime/board/blocks";
import { Diagnostic, PlacedUnit, UnitBoard } from "../runtime/board/units";
import { BlockDefinition, parseBlockDefinition } from "./presets";

function parseDefinitions(
  list: unknown,
  document: string,
  diagnostics: Diagnostic[],
): BlockDefinition[] | undefined {
  if (list === undefined) {
    return undefined;
  }
  if (!Array.isArray(list)) {
    diagnostics.push({
      level: "error",
      code: "block-invalid",
      message: `"blocks" is not a list.`,
      ...(document ? { unit: document } : {}),
    });
    return [];
  }
  return list.flatMap((raw, index) => {
    try {
      return [parseBlockDefinition(raw)];
    } catch (err) {
      diagnostics.push({
        level: "error",
        code: "block-invalid",
        block: typeof raw?.id === "string" ? raw.id : undefined,
        message: `Block ${index + 1}: ${(err as Error).message}`,
        ...(document ? { unit: document } : {}),
      });
      return [];
    }
  });
}

/**
 * A board with every use of a block expanded, and the linkage saving needs to
 * write them back. Applied to the projection, after units are placed: each
 * runtime's uses resolve against the blocks of the document it came from.
 */
export function linkBlocks(
  board: BoardDescriptor,
  units: PlacedUnit[] = [],
): { board: BoardDescriptor; linkage?: BlockLinkage; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const definitions: BlockLinkage["definitions"] = {};
  const own = parseDefinitions(board.blocks, "", diagnostics);
  if (own) {
    definitions[""] = own;
  }
  for (const unit of units) {
    const theirs = parseDefinitions(unit.source.blocks, unit.name, diagnostics);
    if (theirs) {
      definitions[unit.name] = theirs;
    }
  }
  const unitOf = new Map(
    (board.runtimes ?? []).map((runtime) => [runtime.id, runtime.unit ?? ""]),
  );
  const expansion = expandBlocks(
    board.services ?? {},
    definitions,
    (runtimeId) => unitOf.get(runtimeId) ?? "",
  );
  diagnostics.push(...expansion.diagnostics);
  const { blocks: _definitions, ...running } = board;
  const linked =
    expansion.placed.length || Object.keys(definitions).length
      ? { definitions, placed: expansion.placed }
      : undefined;
  return {
    board: { ...running, services: expansion.services },
    linkage: linked,
    diagnostics,
  };
}

/** Every value of a `serviceUuid` field, however deep in a facade. */
function facadeAddresses(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((entry) => facadeAddresses(entry, found));
  } else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (key === "serviceUuid" && typeof inner === "string") {
        found.push(inner);
      } else {
        facadeAddresses(inner, found);
      }
    }
  }
  return found;
}

type ConfiguratorTarget = { address: string; target: string; targetRuntime?: string };

/** Every Configurator in a runtime's pipelines, with its own address and its target. */
function configurators(
  value: unknown,
  ids: string[],
  found: ConfiguratorTarget[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => configurators(entry, ids, found));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const entry = value as Record<string, any>;
  const id = typeof entry.instanceId === "string" ? entry.instanceId : entry.uuid;
  const isService = typeof entry.serviceId === "string";
  const here = isService && typeof id === "string" ? [...ids, id] : ids;
  const target = entry.state?.targetServiceUuid;
  if (
    isService &&
    toCanonicalServiceId(entry.serviceId) === "configurator" &&
    typeof target === "string" &&
    target
  ) {
    found.push({
      address: here.join("."),
      target,
      targetRuntime: entry.state.targetRuntime,
    });
  }
  for (const inner of Object.values(entry)) {
    configurators(inner, here, found);
  }
}

/**
 * What in a linked board addresses the inside of a use — which the board
 * refuses when it is called, and says here, when the board is opened, so a
 * widget that does nothing is not a mystery. A Configurator inside the same
 * use is the block configuring its own parts, and is left alone.
 */
export function checkAddressesIntoUses(
  board: BoardDescriptor,
  linkage: BlockLinkage | undefined,
  facades: unknown[],
): Diagnostic[] {
  if (!linkage?.placed.length) {
    return [];
  }
  const diagnostics: Diagnostic[] = [];
  const refuse = (who: string, address: string, runtimeId?: string) => {
    const use = blockUseContaining(linkage, address, runtimeId);
    if (use) {
      diagnostics.push({
        level: "warning",
        code: "block-address-inside",
        block: use.use.block,
        message: `${who} addresses "${address}", inside a use of block "${use.use.block}"; that is refused — a use is addressed as a whole and varied through its params.`,
      });
    }
  };
  for (const address of new Set(facades.flatMap((facade) => facadeAddresses(facade)))) {
    refuse("A facade widget", address);
  }
  for (const [runtimeId, services] of Object.entries(board.services ?? {})) {
    const found: ConfiguratorTarget[] = [];
    configurators(services, [], found);
    for (const { address, target, targetRuntime } of found) {
      const container = blockUseContaining(linkage, address, runtimeId);
      if (container && target.startsWith(`${container.address}.`)) {
        continue;
      }
      refuse(`Configurator "${address}"`, target, targetRuntime ?? runtimeId);
    }
  }
  return diagnostics;
}

/**
 * A serialised board with its uses written back and its own blocks beside them.
 *
 * `ownOnly` is for a board handed on as one flat document — a share link, the
 * source view — where a unit's uses stay expanded: the unit's blocks are not in
 * that document for them to name.
 */
export function unlinkBlocks<T extends BoardDescriptor>(
  board: T,
  linkage: BlockLinkage | undefined,
  { ownOnly = false }: { ownOnly?: boolean } = {},
): T {
  if (!linkage) {
    return board;
  }
  const own = linkage.definitions[""];
  return {
    ...board,
    ...(own ? { blocks: own } : {}),
    services: collapseBlocks(
      board.services ?? {},
      linkage,
      ownOnly ? [""] : undefined,
    ),
  };
}

/** A unit's document with the blocks it holds now, which editing may have changed. */
export function withUnitBlocks(
  name: string,
  board: UnitBoard,
  linkage: BlockLinkage | undefined,
): UnitBoard {
  const theirs = linkage?.definitions[name];
  return theirs ? { ...board, blocks: theirs } : board;
}
