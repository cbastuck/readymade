/**
 * Resolving a composition's units into documents, and linking them.
 *
 * The transform itself is pure and lives in `runtime/board/units`. What belongs
 * here is the half that depends on the world: turning a `uri` into a board.
 *
 * There is deliberately no unit registry. A registry is a second place that has
 * to know about every unit that exists, and boards do not arrive from anywhere
 * a registry could watch — they come from file pickers, saved boards, share
 * links, a coordinator, an iOS share sheet. So a reference **names**, and the
 * *origin the composition itself was loaded from* **retrieves**: the same
 * `hotels` means a sibling in the picked set, a saved board, or a document
 * beside the share link, depending on where the composition came from. That is
 * what makes a relative reference the sensible default and an absolute URL the
 * deliberate exception.
 *
 * Resolution is transitive — a unit may itself be a composition — because each
 * document resolves its own references against its own origin, exactly the way
 * modules do. Names compose with them (`outer.inner`), so a nested unit's
 * runtimes stay addressable and the invariant the projection checks (every
 * runtime id distinct) still covers them.
 */

import { toast } from "sonner";

import {
  Diagnostic,
  Projection,
  ResolvedUnit,
  UnitBoard,
  UnitEntry,
  parseUnitRef,
  projectUnits,
  unitBaseName,
  unitNameOf,
} from "../runtime/board/units";

/**
 * Where a composition's references are looked up. One per kind of place a board
 * can be loaded from; the loader hands in the one that matches how *this* board
 * arrived.
 */
export type UnitOrigin = {
  /** For diagnostics: how to say where we looked. */
  describe(): string;
  /** The document a reference addresses, or null when this origin has none. */
  load(
    ref: { kind: "relative" | "absolute"; value: string },
  ): Promise<UnitBoard | null>;
};

/** True when a board asks for other documents to be linked into it. */
export function isComposition(board: UnitBoard | undefined): boolean {
  return !!board && Array.isArray(board.units) && board.units.length > 0;
}

/**
 * The playground's origin: relative references come from the boards saved in
 * this browser, absolute URLs are fetched.
 *
 * A `uri` is a document address, and saved boards have no file names — they are
 * keyed by board name. So a relative reference is tried as written and then as
 * its bare base name, which is what a board imported from `hotels.json` is
 * saved under. A board stored under a title that resembles neither is not
 * reachable this way; that is the gap an explicit name would close.
 */
export function defaultUnitOrigin(
  getSavedBoard: (name: string) => UnitBoard | null,
): UnitOrigin {
  return {
    describe: () => "saved boards",
    load: async (ref) => {
      if (ref.kind === "relative") {
        return (
          getSavedBoard(ref.value) ?? getSavedBoard(unitBaseName(ref.value))
        );
      }
      const response = await fetch(ref.value);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as UnitBoard;
    },
  };
}

/**
 * Resolves every unit a board pulls in and projects them into one board.
 *
 * A board with no units comes back as itself — still checked, because the
 * declared-versus-actual topic checks are worth having on a unit opened alone,
 * and because that is what makes running one on its own a first-class case
 * rather than an unvalidated one.
 */
export async function linkBoard(
  root: UnitBoard,
  origin: UnitOrigin,
): Promise<Projection> {
  const diagnostics: Diagnostic[] = [];
  const resolved: ResolvedUnit[] = [];
  // Keyed by what was addressed and what it is called, so naming the same
  // document twice under different names is two instances, and naming it twice
  // under the same name is one.
  const placed = new Set<string>();

  type Pending = { entry: UnitEntry; prefix: string; path: string[] };
  const queue: Pending[] = (root.units ?? []).map((entry) => ({
    entry,
    prefix: "",
    path: [],
  }));

  while (queue.length) {
    const { entry, prefix, path } = queue.shift()!;
    const ref = parseUnitRef(entry.uri);
    if (!ref) {
      diagnostics.push({
        level: "error",
        code: "unit-uri-invalid",
        message: `A unit entry has no usable "uri".`,
      });
      continue;
    }

    if (path.includes(ref.value)) {
      diagnostics.push({
        level: "error",
        code: "unit-cycle",
        message: `Unit "${ref.value}" includes itself: ${[...path, ref.value].join(" → ")}.`,
      });
      continue;
    }

    let board: UnitBoard | null = null;
    try {
      board = await origin.load(ref);
    } catch (err: any) {
      diagnostics.push({
        level: "error",
        code: "unit-unresolved",
        message: `Unit "${entry.uri}" could not be read: ${err?.message ?? err}`,
      });
      continue;
    }
    if (!board) {
      diagnostics.push({
        level: "error",
        code: "unit-unresolved",
        message: `Unit "${entry.uri}" was not found in ${origin.describe()}.`,
      });
      continue;
    }

    const name = prefix
      ? `${prefix}.${unitNameOf(entry, board)}`
      : unitNameOf(entry, board);
    const key = `${ref.value}#${name}`;
    if (placed.has(key)) {
      continue;
    }
    placed.add(key);

    resolved.push({ entry, board, name });

    for (const nested of board.units ?? []) {
      queue.push({ entry: nested, prefix: name, path: [...path, ref.value] });
    }
  }

  const projection = projectUnits(root, resolved);
  return {
    ...projection,
    diagnostics: [...diagnostics, ...projection.diagnostics],
  };
}

/**
 * Says what the link found, once for the whole board.
 *
 * Errors are raised rather than reported: a composition with a hole in it would
 * otherwise start, run, and go wrong later somewhere that cannot explain why.
 * Warnings are the things a unit is allowed to have — an open import is what
 * running one on its own looks like.
 */
export function reportUnitDiagnostics(diagnostics: Diagnostic[]): void {
  for (const entry of diagnostics) {
    const where = entry.unit ? `[${entry.unit}] ` : "";
    if (entry.level === "error") {
      console.error(`Board units: ${where}${entry.message}`);
    } else {
      console.warn(`Board units: ${where}${entry.message}`);
    }
  }

  const errors = diagnostics.filter((entry) => entry.level === "error");
  if (errors.length) {
    throw new Error(
      `This board could not be linked:\n${errors
        .map((entry) => `• ${entry.unit ? `${entry.unit}: ` : ""}${entry.message}`)
        .join("\n")}`,
    );
  }

  const warnings = diagnostics.filter((entry) => entry.level === "warning");
  if (warnings.length) {
    toast.warning(
      warnings.length === 1
        ? warnings[0].message
        : `${warnings.length} things to check in this board's units`,
      { description: warnings.length === 1 ? undefined : warnings[0].message },
    );
  }
}
