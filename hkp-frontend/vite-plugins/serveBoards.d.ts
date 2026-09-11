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
export declare function serveBoards(boardsDir: string): {
    name: string;
    configureServer(server: any): void;
};
