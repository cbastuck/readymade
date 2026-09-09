import fs from "node:fs";
import path from "node:path";

/** The board JSON shipped with the frontend — what the sweep reads. */
const BOARDS_DIR = path.resolve(
  import.meta.dirname,
  "../../hkp-frontend/boards",
);

export type BoardDescriptor = {
  boardName?: string;
  description?: string;
  runtimes?: Array<{ id: string; type?: string }>;
  services?: Record<string, Array<{ uuid: string; serviceName?: string }>>;
  facade?: unknown;
};

export type ShippedBoard = {
  /** File basename without extension — what the board is seeded and opened as. */
  slug: string;
  descriptor: BoardDescriptor;
  /** Service uuids that should render a frame: the browser runtimes' own. */
  browserServiceUuids: string[];
};

/**
 * Every shipped board that runs entirely in the browser.
 *
 * Boards with a `rest` runtime are left out: they reach for an hkp-node,
 * hkp-python or hkp-rt that a sweep has no business starting, and their
 * failure would say nothing about the board. What is left is the set whose
 * loading depends only on this repo, which is what makes the sweep a
 * deterministic check rather than an integration test in disguise.
 */
export function browserOnlyBoards(): ShippedBoard[] {
  return fs
    .readdirSync(BOARDS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const slug = path.basename(file, ".json");
      const descriptor = JSON.parse(
        fs.readFileSync(path.join(BOARDS_DIR, file), "utf8"),
      ) as BoardDescriptor;
      return { file, slug, descriptor };
    })
    .filter(({ descriptor }) => {
      const runtimes = descriptor.runtimes ?? [];
      return (
        runtimes.length > 0 &&
        runtimes.every((runtime) => runtime.type === "browser")
      );
    })
    .map(({ slug, descriptor }) => ({
      slug,
      descriptor,
      browserServiceUuids: (descriptor.runtimes ?? []).flatMap(
        (runtime) =>
          (descriptor.services?.[runtime.id] ?? []).map(
            (service) => service.uuid,
          ),
      ),
    }))
    .filter((board) => board.browserServiceUuids.length > 0);
}
