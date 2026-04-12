import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import GameOfLifeToNotesUI from "./GameOfLifeToNotesUI";
import type { GolFrame } from "./GameOfLife";

/**
 * Service Documentation
 * Service ID: hookup.to/service/game-of-life-notes
 * Service Name: Game of Life Notes
 * Input:  GolFrame — { generation, objects: GolObject[] }
 * Output: NoteFrame — { notes: NoteEvent[] }
 * Config: maxNotes
 *
 * Maps GOL connected-component objects to musical notes.
 * Position (column center, modulo pentatonic scale) → pitch.
 * Cell count → velocity.
 * Objects are sorted by size and capped at maxNotes to avoid cacophony.
 */

export type NoteEvent = {
  frequency: number; // Hz
  velocity: number;  // 0–1
  duration: number;  // ms
};
export type NoteFrame = { notes: NoteEvent[] };

const serviceId = "hookup.to/service/game-of-life-notes";
const serviceName = "Game of Life Notes";

// C pentatonic across three octaves (15 notes: C3–A5).
const PENTATONIC: number[] = [
  130.81, 146.83, 164.81, 196.00, 220.00,
  261.63, 293.66, 329.63, 392.00, 440.00,
  523.25, 587.33, 659.25, 783.99, 880.00,
];

const NOTE_DURATION_MS = 90;
// Cells at this count or above get full velocity.
const VELOCITY_SATURATION = 40;

type State = { maxNotes: number };

class GameOfLifeToNotes extends ServiceBase<State> {
  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { maxNotes: 6 });
  }

  configure(config: any) {
    if (config?.maxNotes !== undefined) {
      this.state.maxNotes = Number(config.maxNotes);
      this.app.notify(this, { maxNotes: this.state.maxNotes });
    }
    return this.state;
  }

  process(frame: GolFrame): NoteFrame {
    if (!frame?.objects?.length) return { notes: [] };

    // Count alive cells per object from its matrix.
    const withCount = frame.objects.map((obj) => {
      const alive = obj.matrix.reduce(
        (sum, row) => sum + row.reduce((s, v) => s + v, 0),
        0,
      );
      // Column center in grid coordinates.
      const centerCol = obj.col + (obj.matrix[0].length - 1) / 2;
      return { obj, alive, centerCol };
    });

    // Take the top N objects by cell count.
    withCount.sort((a, b) => b.alive - a.alive);
    const selected = withCount.slice(0, this.state.maxNotes);

    const notes: NoteEvent[] = selected.map(({ alive, centerCol }) => {
      // Map column position (mod scale length) to pentatonic frequency.
      const index = Math.abs(Math.round(centerCol)) % PENTATONIC.length;
      const frequency = PENTATONIC[index];
      const velocity = Math.min(1, alive / VELOCITY_SATURATION);
      return { frequency, velocity, duration: NOTE_DURATION_MS };
    });

    this.app.notify(this, { noteCount: notes.length });
    return { notes };
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new GameOfLifeToNotes(app, board, descriptor, id),
  createUI: GameOfLifeToNotesUI as any,
};

export default descriptor;
