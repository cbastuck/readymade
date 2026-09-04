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
  getSavedBoard: (
    name: string,
  ) => UnitBoard | null | Promise<UnitBoard | null>,
): UnitOrigin {
  return {
    describe: () => "saved boards",
    load: async (ref) => {
      if (ref.kind === "relative") {
        return (
          (await getSavedBoard(ref.value)) ??
          (await getSavedBoard(unitBaseName(ref.value)))
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
        uri: entry.uri,
        message: `Unit "${entry.uri}" could not be read: ${err?.message ?? err}`,
      });
      continue;
    }
    if (!board) {
      // Saying where we looked matters more here than usual: a `uri` is
      // relative to wherever the composition came from, so the same reference
      // is resolvable one way of opening a board and not another.
      diagnostics.push({
        level: "error",
        code: "unit-unresolved",
        uri: entry.uri,
        message:
          `Unit "${entry.uri}" was not found in ${origin.describe()}. ` +
          `Open the composition and its units together, load it from a URL they sit beside, ` +
          `or save the unit as a board named "${unitBaseName(ref.value)}".`,
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
export type UnitLinkError = Error & {
  /** The composition that failed, ready to be linked again. */
  board?: UnitBoard;
  /** The `uri` of every unit that could not be found. */
  missing: string[];
};

/** True for the error `reportUnitDiagnostics` throws, which carries a remedy. */
export function isUnitLinkError(error: unknown): error is UnitLinkError {
  return (
    error instanceof Error && Array.isArray((error as UnitLinkError).missing)
  );
}

export function reportUnitDiagnostics(
  diagnostics: Diagnostic[],
  board?: UnitBoard,
): void {
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
    const failure: UnitLinkError = Object.assign(
      new Error(
        `This board could not be linked:\n${errors
          .map(
            (entry) => `• ${entry.unit ? `${entry.unit}: ` : ""}${entry.message}`,
          )
          .join("\n")}`,
      ),
      {
        // What the board was, and which of its units could not be found, so
        // whoever shows this can offer to go and get them rather than leaving
        // the reader to work out which files are meant.
        board,
        missing: diagnostics
          .filter((entry) => entry.code === "unit-unresolved")
          .map((entry) => entry.uri)
          .filter((uri): uri is string => !!uri),
      },
    );
    throw failure;
  }

  const warnings = diagnostics.filter((entry) => entry.level === "warning");
  if (warnings.length) {
    // All of them, not the first of them: these are a list of independent
    // observations about different units, and showing one while counting three
    // leaves the reader knowing something is wrong and not what.
    toast.warning(
      warnings.length === 1
        ? warnings[0].message
        : `${warnings.length} things to check in this board's units`,
      warnings.length === 1
        ? undefined
        : {
            description: warnings
              .map((entry) => `• ${entry.message}`)
              .join("\n"),
            style: { whiteSpace: "pre-line" },
            duration: 10000,
          },
    );
  }
}

/**
 * A set of documents that arrived together — several files dropped at once, or
 * picked in one dialog — as an origin.
 *
 * This is the most literal reading of "the origin the composition came from":
 * the composition and its units were handed over in one gesture, so the gesture
 * is the scope. A browser gives a page no access to the siblings of a single
 * dropped file, which is why dropping a composition on its own cannot resolve
 * anything and dropping it *with* its units can.
 */
export function filesUnitOrigin(
  documents: Map<string, UnitBoard>,
): UnitOrigin {
  const byBaseName = new Map<string, UnitBoard>();
  for (const [name, board] of documents) {
    byBaseName.set(unitBaseName(name), board);
  }
  return {
    describe: () => "the files that were opened",
    load: async (ref) =>
      documents.get(ref.value) ??
      byBaseName.get(unitBaseName(ref.value)) ??
      null,
  };
}

/**
 * A composition that was fetched from a URL, resolving its units beside it.
 *
 * This is what "relative to the composition" can actually mean in a browser.
 * A page cannot read `file://`, and a file the user picked comes with no access
 * to the folder it sits in — so a reference next to a *file* is only resolvable
 * when the files were handed over together (`filesUnitOrigin`). A reference
 * next to a *URL* needs nothing extra: `syn-hotels-unit-board.json` beside
 * `/boards/syn-board.json` is an ordinary relative URL, and the units come from
 * wherever the composition did.
 */
export function urlUnitOrigin(baseUrl: string): UnitOrigin {
  const base = new URL(baseUrl, window.location.href);
  return {
    describe: () => `the location of ${base.pathname}`,
    load: async (ref) => {
      const target =
        ref.kind === "absolute" ? ref.value : new URL(ref.value, base).href;
      const response = await fetch(target);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as UnitBoard;
    },
  };
}

/**
 * Several origins tried in turn, so a board can be reachable more than one way.
 *
 * The first that answers wins; one that throws is treated as not having the
 * document rather than as a failure, since a later origin may still have it.
 * Only when none answer does the caller see an unresolved unit.
 */
export function chainUnitOrigins(...origins: UnitOrigin[]): UnitOrigin {
  const usable = origins.filter(Boolean);
  return {
    describe: () => usable.map((origin) => origin.describe()).join(", or "),
    load: async (ref) => {
      for (const origin of usable) {
        try {
          const board = await origin.load(ref);
          if (board) {
            return board;
          }
        } catch {
          // Try the next one; the last word belongs to the caller.
        }
      }
      return null;
    },
  };
}

/**
 * A composition opened from a real file, resolving its units beside it on disk.
 *
 * This is the case a browser cannot do and a native shell can. A page given a
 * file through `<input type="file">` learns nothing about the folder it came
 * from, so a composition picked that way can only be linked if its units were
 * handed over with it. A native picker returns a *path*, and a native read
 * takes one — so `syn-hotels-unit-board.json` beside
 * `file:///…/boards/syn-board.json` resolves exactly the way the reference
 * reads, with nothing to pick twice and nothing to save first.
 *
 * `readFile` is passed in rather than imported: this package knows nothing
 * about which shell it is running in, and the shells are the ones that have it.
 */
export function nativeFileUnitOrigin(
  compositionPath: string,
  readFile: (uri: string) => Promise<string>,
): UnitOrigin {
  const base = toFileUrl(compositionPath);
  return {
    describe: () => `the folder holding ${base.pathname.split("/").pop()}`,
    load: async (ref) => {
      if (ref.kind === "absolute" && !ref.value.startsWith("file:")) {
        const response = await fetch(ref.value);
        return response.ok ? ((await response.json()) as UnitBoard) : null;
      }
      const target = new URL(ref.value, base).href;
      const source = await readFile(target);
      return source ? (JSON.parse(source) as UnitBoard) : null;
    },
  };
}

/**
 * Where a unit reference points, given the file its composition was read from.
 *
 * Exposed because copying a composition into a library has to fetch the same
 * neighbours the linker would, and should not have to reimplement how a
 * reference resolves to do it.
 */
export function resolveUnitFileUrl(
  compositionPath: string,
  uri: string,
): string {
  return new URL(uri, toFileUrl(compositionPath)).href;
}

/**
 * A native picker may hand back either a `file://` URL or a plain path; both
 * mean the same file, and only the URL form composes with a relative reference.
 */
function toFileUrl(pathOrUri: string): URL {
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUri)) {
    return new URL(pathOrUri);
  }
  return new URL(`file://${pathOrUri.startsWith("/") ? "" : "/"}${pathOrUri}`);
}
