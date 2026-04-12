import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import GameOfLifeSynthUI from "./GameOfLifeSynthUI";
import type { NoteFrame } from "./GameOfLifeToNotes";

/**
 * Service Documentation
 * Service ID: hookup.to/service/game-of-life-synth
 * Service Name: Game of Life Synth
 * Input:  NoteFrame — { notes: NoteEvent[] }
 * Output: pass-through
 * Config: volume, waveType
 *
 * Plays each incoming note immediately via the Web Audio API.
 * Each note gets a short linear ADSR envelope (attack 10ms, release 30ms).
 * AudioContext is created lazily on first process() call.
 *
 * Built-in oscillator types: sine, square, sawtooth, triangle.
 * Custom PeriodicWave types (additive synthesis):
 *   organ  — Hammond-style harmonics (1, 2, 3, 4, 6, 8)
 *   soft   — sine + gentle 2nd harmonic for warmth
 *   fifth  — root + perfect fifth stacked (open pipe-organ feel)
 */

const serviceId = "hookup.to/service/game-of-life-synth";
const serviceName = "Game of Life Synth";

export type WaveType =
  | "sine" | "triangle" | "square" | "sawtooth"
  | "organ" | "soft" | "fifth";

// Fourier coefficients for custom waves.
// Index 0 = DC (ignored), index 1 = fundamental, index 2 = 2nd harmonic, …
// imaginary array is all zeros (cosine-only, symmetric waveform).
const CUSTOM_WAVES: Record<string, { real: number[]; imag: number[] }> = {
  organ: {
    // Hammond B3-style: strong fundamental + upper harmonics
    real: [0, 1, 0.8, 0.5, 0.3, 0, 0.2, 0, 0.1],
    imag: [0, 0,   0,   0,   0, 0,   0, 0,   0],
  },
  soft: {
    // Sine with a breath of 2nd harmonic — rounder than pure sine
    real: [0, 1, 0.25, 0.08],
    imag: [0, 0,    0,    0],
  },
  fifth: {
    // Fundamental (index 1) + perfect fifth = 3/2 ratio.
    // Approximate by boosting harmonics 2 and 3 (octave + fifth above).
    real: [0, 1, 0, 0.6, 0, 0, 0],
    imag: [0, 0, 0,   0, 0, 0, 0],
  },
};

type State = {
  volume: number;   // 0–1
  waveType: WaveType;
};

const ATTACK_S  = 0.010;
const RELEASE_S = 0.030;

class GameOfLifeSynth extends ServiceBase<State> {
  private ctx: AudioContext | null = null;
  // Cache PeriodicWave objects so they are only created once per AudioContext.
  private periodicWaveCache = new Map<string, PeriodicWave>();

  constructor(app: AppInstance, board: string, descriptor: ServiceClass, id: string) {
    super(app, board, descriptor, id, { volume: 0.25, waveType: "sawtooth" });
  }

  configure(config: any) {
    if (config?.volume !== undefined) {
      this.state.volume = Math.max(0, Math.min(1, Number(config.volume)));
      this.app.notify(this, { volume: this.state.volume });
    }
    if (config?.waveType !== undefined) {
      this.state.waveType = config.waveType;
      this.app.notify(this, { waveType: this.state.waveType });
    }
    return this.state;
  }

  process(noteFrame: NoteFrame) {
    const notes = noteFrame?.notes;
    if (!notes?.length) return noteFrame;

    const ctx = this.audioContext();
    const now = ctx.currentTime;

    for (const note of notes) {
      this.scheduleNote(ctx, now, note.frequency, note.velocity, note.duration / 1000);
    }

    return noteFrame;
  }

  destroy() {
    this.ctx?.close();
    this.ctx = null;
    this.periodicWaveCache.clear();
  }

  // ── Audio helpers ─────────────────────────────────────────────────────────

  private audioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
      this.periodicWaveCache.clear();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getPeriodicWave(ctx: AudioContext, name: string): PeriodicWave {
    if (!this.periodicWaveCache.has(name)) {
      const { real, imag } = CUSTOM_WAVES[name];
      this.periodicWaveCache.set(
        name,
        ctx.createPeriodicWave(new Float32Array(real), new Float32Array(imag)),
      );
    }
    return this.periodicWaveCache.get(name)!;
  }

  private scheduleNote(
    ctx: AudioContext,
    startTime: number,
    frequency: number,
    velocity: number,
    durationSec: number,
  ) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    if (CUSTOM_WAVES[this.state.waveType]) {
      osc.setPeriodicWave(this.getPeriodicWave(ctx, this.state.waveType));
    } else {
      osc.type = this.state.waveType as OscillatorType;
    }
    osc.frequency.value = frequency;

    const peak = velocity * this.state.volume;
    const sustainEnd = Math.max(startTime + ATTACK_S, startTime + durationSec - RELEASE_S);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + ATTACK_S);
    gain.gain.setValueAtTime(peak, sustainEnd);
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationSec);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, descriptor: ServiceClass, id: string) =>
    new GameOfLifeSynth(app, board, descriptor, id),
  createUI: GameOfLifeSynthUI as any,
};

export default descriptor;
