import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import GameOfLifeUI from "./GameOfLifeUI";

/**
 * Service Documentation
 * Service ID: hookup.to/service/game-of-life
 * Service Name: Game of Life
 * Input: timer tick { triggerCount }
 * Output: { generation: number, objects: GolObject[] }
 *   where GolObject = {
 *     row: number,   // top-left row of the bounding box in the infinite grid
 *     col: number,   // top-left col of the bounding box in the infinite grid
 *     matrix: number[][]  // [rows][cols] tight bounding-box matrix, 1=alive 0=dead
 *   }
 *   Each object is a maximal set of 8-connected alive cells (connected component).
 * Config: reset
 *
 * Pure game logic — no rendering, no canvas knowledge.
 * Uses a sparse Set<string> for an infinite grid.
 */

export type GolObject = {
  row: number;      // top-left row of bounding box
  col: number;      // top-left col of bounding box
  matrix: number[][];  // [rowIndex][colIndex], 1 = alive, 0 = dead
};
export type GolFrame = { generation: number; objects: GolObject[] };

const serviceId = "hookup.to/service/game-of-life";
const serviceName = "Game of Life";

// Gosper Glider Gun — the classic infinite-growth pattern.
// Coordinates are [row, col] relative to a (0,0) origin.
const GOSPER_GLIDER_GUN: [number, number][] = [
  [0, 24],
  [1, 22], [1, 24],
  [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
  [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35],
  [4,  0], [4,  1], [4, 10], [4, 16], [4, 20], [4, 21],
  [5,  0], [5,  1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
  [6, 10], [6, 16], [6, 24],
  [7, 11], [7, 15],
  [8, 12], [8, 13],
];

type State = {
  generation: number;
};

class GameOfLife extends ServiceBase<State> {
  // Sparse infinite grid: key = "row,col"
  private cells: Set<string> = new Set();

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { generation: 0 });
    this.seedInitialGrid();
  }

  configure(config: any) {
    if (config?.reset) {
      this.state.generation = 0;
      this.seedInitialGrid();
      this.app.notify(this, { generation: 0 });
    }
    return this.state;
  }

  process(_params: any): GolFrame {
    this.stepGrid();
    this.state.generation++;
    this.app.notify(this, { generation: this.state.generation });

    return {
      generation: this.state.generation,
      objects: this.findConnectedComponents(),
    };
  }

  // ── Grid ─────────────────────────────────────────────────────────────────

  private seedInitialGrid() {
    this.cells = new Set();
    const offsetRow = 5;
    const offsetCol = 5;
    for (const [r, c] of GOSPER_GLIDER_GUN) {
      this.cells.add(`${offsetRow + r},${offsetCol + c}`);
    }
  }

  /** Sparse Conway step — only considers cells adjacent to live cells. */
  private stepGrid() {
    const neighborCount = new Map<string, number>();

    for (const key of this.cells) {
      const [r, c] = parseKey(key);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nk = `${r + dr},${c + dc}`;
          neighborCount.set(nk, (neighborCount.get(nk) ?? 0) + 1);
        }
      }
    }

    const next = new Set<string>();
    for (const [key, count] of neighborCount) {
      if (count === 3 || (count === 2 && this.cells.has(key))) {
        next.add(key);
      }
    }
    this.cells = next;
  }

  /**
   * Flood-fill (BFS) to partition alive cells into maximal 8-connected groups.
   * Each group is encoded as a tight bounding-box matrix (1=alive, 0=dead).
   */
  private findConnectedComponents(): GolObject[] {
    const visited = new Set<string>();
    const objects: GolObject[] = [];

    for (const startKey of this.cells) {
      if (visited.has(startKey)) continue;

      // Collect all cells in this component.
      const componentCells: [number, number][] = [];
      const queue: string[] = [startKey];
      visited.add(startKey);

      while (queue.length > 0) {
        const key = queue.pop()!;
        const [r, c] = parseKey(key);
        componentCells.push([r, c]);

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nk = `${r + dr},${c + dc}`;
            if (this.cells.has(nk) && !visited.has(nk)) {
              visited.add(nk);
              queue.push(nk);
            }
          }
        }
      }

      // Compute tight bounding box.
      let minRow = Infinity, minCol = Infinity;
      let maxRow = -Infinity, maxCol = -Infinity;
      for (const [r, c] of componentCells) {
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }

      // Allocate a zero-filled matrix sized to the bounding box.
      const rows = maxRow - minRow + 1;
      const cols = maxCol - minCol + 1;
      const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

      for (const [r, c] of componentCells) {
        matrix[r - minRow][c - minCol] = 1;
      }

      objects.push({ row: minRow, col: minCol, matrix });
    }

    return objects;
  }
}

function parseKey(key: string): [number, number] {
  const comma = key.indexOf(",");
  return [parseInt(key, 10), parseInt(key.slice(comma + 1), 10)];
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new GameOfLife(app, board, descriptor, id),
  createUI: GameOfLifeUI as any,
};

export default descriptor;
