/**
 * What a person does to a use of a block on the running board: change its
 * params, or detach it. The only two edits a use takes — its inside belongs to
 * its definition (see `runtime/board/blocks`).
 */

import { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import type { BoardContextState } from "../BoardContext";
import { findService } from "../facade/boardServices";
import {
  BlockPathStep,
  collapseBlocks,
  definitionFromWorkingCopy,
  detachUse,
  findEntryPath,
  outermostUses,
  usesToRefresh,
  withBlockFrom,
  withDefinition,
  withUseParams,
} from "../runtime/board/blocks";
import { BlockDefinition, presetFromService } from "./presets";
import { BoardLinkage } from "../runtime/board/units";

/**
 * Sets these params on one use, keeping the others it has, re-instantiates it
 * and configures the running service with the result, by the use's own
 * address. A block's state names exactly the keys its definition does, so a
 * configure is a replace; for a sub-service it rebuilds only the use's own
 * pipeline, and its siblings keep running.
 *
 * Linkage is updated only once the running service took it: what saving
 * writes must be what is running. The params are read from `latestLinkage`
 * rather than from what a panel last rendered, and written onto whatever the
 * linkage is by the time the service answered — so two changes made while an
 * earlier one is still on its way both land, provided they are not started
 * before it finishes (see `BoardContext`, which queues them).
 *
 * `isCurrent` says whether the board the change was made on is still the one
 * open. Keys are paths, and the next board may well have a use at the same
 * one: a change that outlived its board is dropped rather than applied there,
 * both before it starts and once its service answered.
 */
export async function setBlockParams(
  key: string,
  changed: Record<string, unknown>,
  boardContext: BoardContextState,
  latestLinkage: () => BoardLinkage | undefined,
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  if (!isCurrent()) {
    return;
  }
  const blocks = latestLinkage()?.blocks;
  if (!blocks) {
    throw new Error("setBlockParams: this board has no blocks");
  }
  const current = blocks.placed.find((entry) => entry.key === key);
  if (!current) {
    throw new Error(`setBlockParams: no use of a block is placed at ${key}`);
  }
  const params = { ...current.use.params, ...changed };
  const { linkage, service, diagnostics } = withUseParams(blocks, key, params);
  const errors = diagnostics.filter((entry) => entry.level === "error");
  if (errors.length) {
    toast.error("These parameters do not make a block", {
      description: errors.map((entry) => entry.message).join("\n"),
    });
    return;
  }
  for (const entry of diagnostics) {
    console.warn(`Block params: ${entry.message}`);
  }
  const placed = linkage.placed.find((entry) => entry.key === key)!;
  const running = findService(boardContext, placed.address, placed.runtimeId);
  if (!running) {
    throw new Error(`setBlockParams: nothing is running at "${placed.address}"`);
  }
  await running.configure(service.state);
  if (!isCurrent()) {
    return;
  }
  // Re-derived from what the linkage is now, not replaced with what it was:
  // anything else that changed while the service was answering is kept.
  setLinkage((prev) =>
    prev?.blocks?.placed.some((entry) => entry.key === key)
      ? { ...prev, blocks: withUseParams(prev.blocks, key, params).linkage }
      : prev,
  );
}

/** Turns one use into an ordinary copy of what it expanded to, from here on. */
export function detachBlockUse(
  key: string,
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>,
): void {
  setLinkage((prev) =>
    prev?.blocks ? { ...prev, blocks: detachUse(prev.blocks, key) } : prev,
  );
}

/**
 * Turns a configured service into a block of this board, and the service into
 * its first use. What runs does not change; what saving writes does — the
 * definition beside the board's services, and the use where the service was.
 *
 * Read from the board as saving would see it, with the uses already inside the
 * service written back as uses, so the definition names blocks rather than
 * carrying copies of what they expand to.
 */
export async function makeBlock(
  address: string,
  runtimeId: string | undefined,
  boardContext: BoardContextState,
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>,
): Promise<BlockDefinition> {
  const serialized = await boardContext.serializeBoard();
  if (!serialized) {
    throw new Error("makeBlock: the board could not be read");
  }
  const blocks = boardContext.linkage?.blocks;
  const services = blocks
    ? collapseBlocks(serialized.services, blocks)
    : serialized.services;
  const path = findEntryPath(services, address, runtimeId);
  if (!path) {
    throw new Error(`makeBlock: nothing on the board is at "${address}"`);
  }
  const holderId = path[0] as string;
  const runtime = boardContext.runtimes.find((entry) => entry.id === holderId);
  const document = runtime?.unit ?? "";
  const entry = entryAt(services, path);
  const name = entry.serviceName || entry.serviceId;
  const taken = new Set((blocks?.definitions[document] ?? []).map((d) => d.id));
  const { preset: _marker, ...definition } = presetFromService(
    entry,
    entry.state ?? {},
    name,
  );
  let id = definition.id;
  for (let n = 2; taken.has(id); n++) {
    id = `${definition.id}-${n}`;
  }
  const made: BlockDefinition = { ...definition, id };
  const linkage = withBlockFrom(blocks, { runtimeId: holderId, document, path, definition: made });
  setLinkage((prev) => ({
    units: prev?.units ?? [],
    views: prev?.views ?? [],
    ...prev,
    blocks: linkage,
  }));
  return made;
}

function entryAt(services: unknown, path: BlockPathStep[]): any {
  let current: any = services;
  for (const step of path) {
    current =
      typeof step === "object"
        ? (current as any[]).find(
            (element) => (element?.instanceId ?? element?.uuid) === step.id,
          )
        : current?.[step];
  }
  return current;
}

/**
 * Unlocks one use as the working copy of its block's definition. Only one at a
 * time, and only a use nothing attached contains — inside one, everything is
 * that one's.
 */
export function editBlock(
  key: string,
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>,
): void {
  setLinkage((prev) => {
    const blocks = prev?.blocks;
    if (!blocks) {
      return prev;
    }
    if (blocks.editing) {
      throw new Error("A block is already being edited; apply or cancel that first");
    }
    const placed = outermostUses(blocks).find((entry) => entry.key === key);
    if (!placed) {
      throw new Error("Only a use nothing else contains can be edited");
    }
    return { ...prev, blocks: { ...blocks, editing: key } };
  });
}

/** Re-instantiates each of these uses and configures what runs with the result. */
async function refresh(
  linkage: NonNullable<BoardLinkage["blocks"]>,
  keys: string[],
  boardContext: BoardContextState,
) {
  let current = linkage;
  for (const key of keys) {
    const placed = current.placed.find((entry) => entry.key === key);
    if (!placed) {
      continue;
    }
    const next = withUseParams(current, key, placed.use.params ?? {});
    const running = findService(boardContext, placed.address, placed.runtimeId);
    if (!running) {
      console.warn(`Block: nothing is running at "${placed.address}" to refresh`);
      continue;
    }
    await running.configure(next.service.state);
    current = next.linkage;
  }
  return current;
}

/**
 * The working copy becomes the definition, and every use of the block is
 * re-instantiated from it — the working copy included, which locks again.
 * Timers inside restart: that is what an edit to a definition costs.
 */
export async function applyBlockEdit(
  boardContext: BoardContextState,
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>,
): Promise<void> {
  const blocks = boardContext.linkage?.blocks;
  const working = blocks?.placed.find((entry) => entry.key === blocks.editing);
  if (!blocks || !working) {
    return;
  }
  const serialized = await boardContext.serializeBoard();
  if (!serialized) {
    throw new Error("applyBlockEdit: the board could not be read");
  }
  // Everything written back as saving would, except the working copy itself,
  // whose expansion is what is being read — with the uses inside it as uses.
  const others = { ...blocks, placed: blocks.placed.filter((entry) => entry !== working) };
  const services = collapseBlocks(serialized.services, others);
  const entry = entryAt(services, working.path);
  const definition = blocks.definitions[working.document]?.find(
    (candidate) => candidate.id === working.use.block,
  );
  if (!entry || !definition) {
    throw new Error("applyBlockEdit: the working copy is gone");
  }
  const rewritten = definitionFromWorkingCopy(
    definition,
    working.use.params ?? {},
    entry.state ?? {},
  );
  for (const warning of rewritten.warnings) {
    toast.warning(`Block "${definition.name}"`, { description: warning });
  }
  // The params a use says nothing about stay unsaid, so a use written without
  // any is written back without any.
  const { params: _previous, ...bare } = working.use;
  const use = Object.keys(rewritten.params).length
    ? { ...bare, params: rewritten.params }
    : bare;
  const withNew = withDefinition(blocks, working.document, rewritten.definition);
  const next = {
    ...withNew,
    editing: undefined,
    placed: withNew.placed.map((placed) =>
      placed.key === working.key ? { ...placed, use } : placed,
    ),
  };
  const keys = usesToRefresh(next, definition.id, working.document).map((entry) => entry.key);
  const refreshed = await refresh(next, keys, boardContext);
  setLinkage((prev) => (prev ? { ...prev, blocks: refreshed } : prev));
}

/** Puts the working copy back as its unchanged definition makes it, and locks it again. */
export async function cancelBlockEdit(
  boardContext: BoardContextState,
  setLinkage: Dispatch<SetStateAction<BoardLinkage | undefined>>,
): Promise<void> {
  const blocks = boardContext.linkage?.blocks;
  if (!blocks?.editing) {
    return;
  }
  const refreshed = await refresh(
    { ...blocks, editing: undefined },
    [blocks.editing],
    boardContext,
  );
  setLinkage((prev) => (prev ? { ...prev, blocks: refreshed } : prev));
}
