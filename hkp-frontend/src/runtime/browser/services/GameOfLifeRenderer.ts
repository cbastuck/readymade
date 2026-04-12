import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import GameOfLifeRendererUI from "./GameOfLifeRendererUI";
import type { GolFrame, GolObject } from "./GameOfLife";

/**
 * Service Documentation
 * Service ID: hookup.to/service/game-of-life-renderer
 * Service Name: Game of Life Renderer
 * Input: GolFrame — { generation, objects: GolObject[] }
 * Output: array of Canvas rect draw commands, one per visible alive cell
 * Config: cellSize, canvasWidth, canvasHeight
 *
 * Owns all rendering concerns: cell size, viewport, panning, culling, color.
 * Receives the domain objects from GameOfLife and maps each cell in each
 * object to a { type:"rect", ... } command. Objects are color-coded by size
 * so gliders, still-lifes, and the gun are visually distinct.
 */

const serviceId = "hookup.to/service/game-of-life-renderer";
const serviceName = "Game of Life Renderer";

// Smoothing factor for exponential-blend panning toward center of mass.
const PAN_SMOOTHING = 0.04;

// Color by object size bucket.
function objectColor(cellCount: number): string {
  if (cellCount >= 20) return "#0d47a1"; // large structures (gun, eater) — deep blue
  if (cellCount >= 5) return "#1b5e20";  // mid-size (gliders in transit) — deep green
  return "#b71c1c";                       // small debris / still-lifes — deep red
}

type State = {
  cellSize: number;
  canvasWidth: number;
  canvasHeight: number;
};

class GameOfLifeRenderer extends ServiceBase<State> {
  private viewCenterRow = 0;
  private viewCenterCol = 0;
  private initialized = false;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      cellSize: 8,
      canvasWidth: 600,
      canvasHeight: 400,
    });
  }

  configure(config: any) {
    const { cellSize, canvasWidth, canvasHeight } = config || {};
    if (cellSize !== undefined) {
      this.state.cellSize = Number(cellSize);
      this.app.notify(this, { cellSize: this.state.cellSize });
    }
    if (canvasWidth !== undefined) {
      this.state.canvasWidth = Number(canvasWidth);
    }
    if (canvasHeight !== undefined) {
      this.state.canvasHeight = Number(canvasHeight);
    }
    return this.state;
  }

  process(frame: GolFrame) {
    if (!frame?.objects) return [];

    const { cellSize, canvasWidth, canvasHeight } = this.state;
    const { objects } = frame;

    // Compute center of mass across all alive cells by scanning each matrix.
    let totalCells = 0;
    let sumRow = 0;
    let sumCol = 0;
    for (const obj of objects) {
      for (let r = 0; r < obj.matrix.length; r++) {
        for (let c = 0; c < obj.matrix[r].length; c++) {
          if (obj.matrix[r][c]) {
            sumRow += obj.row + r;
            sumCol += obj.col + c;
            totalCells++;
          }
        }
      }
    }

    if (totalCells === 0) return [];

    const comRow = sumRow / totalCells;
    const comCol = sumCol / totalCells;

    if (!this.initialized) {
      this.viewCenterRow = comRow;
      this.viewCenterCol = comCol;
      this.initialized = true;
    } else {
      this.viewCenterRow += (comRow - this.viewCenterRow) * PAN_SMOOTHING;
      this.viewCenterCol += (comCol - this.viewCenterCol) * PAN_SMOOTHING;
    }

    // Top-left cell coordinate of the viewport.
    const originRow = this.viewCenterRow - canvasHeight / 2 / cellSize;
    const originCol = this.viewCenterCol - canvasWidth / 2 / cellSize;

    return this.buildRects(objects, originRow, originCol, cellSize, canvasWidth, canvasHeight);
  }

  private buildRects(
    objects: GolObject[],
    originRow: number,
    originCol: number,
    cellSize: number,
    canvasWidth: number,
    canvasHeight: number,
  ): any[] {
    const rects: any[] = [];

    for (const obj of objects) {
      const totalAlive = obj.matrix.reduce(
        (sum, row) => sum + row.reduce((s, v) => s + v, 0),
        0,
      );
      const color = objectColor(totalAlive);

      for (let r = 0; r < obj.matrix.length; r++) {
        for (let c = 0; c < obj.matrix[r].length; c++) {
          if (!obj.matrix[r][c]) continue;

          const x = (obj.col + c - originCol) * cellSize;
          const y = (obj.row + r - originRow) * cellSize;

          // Cull cells entirely outside the canvas.
          if (x + cellSize < 0 || x > canvasWidth || y + cellSize < 0 || y > canvasHeight) {
            continue;
          }

          rects.push({
            type: "rect",
            x: Math.round(x),
            y: Math.round(y),
            width: cellSize,
            height: cellSize,
            color,
          });
        }
      }
    }

    return rects;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new GameOfLifeRenderer(app, board, descriptor, id),
  createUI: GameOfLifeRendererUI as any,
};

export default descriptor;
