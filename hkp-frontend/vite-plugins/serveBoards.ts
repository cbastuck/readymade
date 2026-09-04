import path from "path";
import fs from "fs";

/**
 * Serves the board JSON files under `/boards` in dev.
 *
 * Shared by every dev server that hosts the playground — `hkp-frontend`'s own
 * and the native shells' — because a board's *location* is part of how it
 * loads, not a detail of one server. A composition resolves its units relative
 * to where it was fetched from, so `?src=/boards/syn-board.json` finds
 * `/boards/syn-hotels-unit-board.json` beside it; on a server that does not
 * serve this directory the same URL quietly returns `index.html`, and the board
 * fails to parse rather than failing to link.
 *
 * In production the boards directory is copied to the build output.
 */
export function serveBoards(boardsDir: string) {
  const root = path.resolve(boardsDir);
  return {
    name: "serve-boards",
    configureServer(server: any) {
      server.middlewares.use(
        "/boards",
        (req: any, res: any, next: () => void) => {
          const filePath = path.resolve(root, req.url.replace(/^\//, ""));
          if (
            filePath.startsWith(root) &&
            fs.existsSync(filePath) &&
            fs.statSync(filePath).isFile()
          ) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(fs.readFileSync(filePath, "utf-8"));
          } else {
            next();
          }
        },
      );
    },
  };
}
