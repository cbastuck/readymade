import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import SoundUI from "./SoundUI";
type NoteEvent = { frequency: number; velocity: number; duration: number };
type NoteFrame = { notes: NoteEvent[] };

/**
 * Service Documentation
 * Service ID: hookup.to/service/sound
 * Service Name: Sound
 * Input:  { note: string } | Array<{ note: string }> | NoteFrame
 * Output: pass-through
 * Config: generator.type ("synth" | "drums"), volume, waveType, noteDuration
 *
 * Two generator modes:
 *
 *   synth  — Oscillator-based. Converts note names (e.g. "C4") to Hz
 *             using standard MIDI tuning (A4 = 440 Hz). Configurable
 *             waveType and noteDuration. Also accepts NoteFrame objects
 *             from the game-of-life pipeline.
 *
 *   drums  — Synthesises kick, snare, and hi-hat purely via Web Audio API
 *             (no sample files). Notes are mapped to drum types via
 *             drumMap (default: C4→kick, D4→snare, E4→hihat).
 */

const serviceId = "hookup.to/service/sound";
const serviceName = "Sound";

export type GeneratorType = "synth" | "drums";
export type WaveType =
  | "sine" | "triangle" | "square" | "sawtooth"
  | "organ" | "soft" | "fifth";

const CUSTOM_WAVES: Record<string, { real: number[]; imag: number[] }> = {
  organ: {
    real: [0, 1, 0.8, 0.5, 0.3, 0, 0.2, 0, 0.1],
    imag: [0, 0,   0,   0,   0, 0,   0, 0,   0],
  },
  soft: {
    real: [0, 1, 0.25, 0.08],
    imag: [0, 0,    0,    0],
  },
  fifth: {
    real: [0, 1, 0, 0.6, 0, 0, 0],
    imag: [0, 0, 0,   0, 0, 0, 0],
  },
};
export type DrumType = "kick" | "snare" | "hihat";

type State = {
  volume: number;
  generator: GeneratorType;
  waveType: WaveType;
  noteDuration: number; // seconds, used in synth mode
  drumMap: Record<string, DrumType>; // note name → drum type
};

const DEFAULT_DRUM_MAP: Record<string, DrumType> = {
  C4: "kick",
  D4: "snare",
  E4: "hihat",
};

// ── Note name → frequency ────────────────────────────────────────────────────

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function noteNameToFrequency(note: string): number {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return 0;
  }
  const idx = NOTE_NAMES.indexOf(match[1]);
  if (idx < 0) {
    return 0;
  }
  const midi = (parseInt(match[2]) + 1) * 12 + idx;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Drum synthesis ───────────────────────────────────────────────────────────

function makeNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function synthesizeKick(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

function synthesizeSnare(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;

  // Noise burst through a bandpass filter
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = makeNoiseBuffer(ctx, 0.2);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 1200;
  noiseFilter.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // Short tonal snap for body
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 180;
  oscGain.gain.setValueAtTime(volume * 0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noiseSource.start(now);
  noiseSource.stop(now + 0.2);
  osc.start(now);
  osc.stop(now + 0.08);
}

function synthesizeHihat(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const duration = 0.08;
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = makeNoiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume * 0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noiseSource.start(now);
  noiseSource.stop(now + duration);
}

// ── Service ──────────────────────────────────────────────────────────────────

class Sound extends ServiceBase<State> {
  private ctx: AudioContext | null = null;
  private periodicWaveCache = new Map<string, PeriodicWave>();

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      volume: 0.7,
      generator: "drums",
      waveType: "sine",
      noteDuration: 0.3,
      drumMap: { ...DEFAULT_DRUM_MAP },
    });
  }

  configure(config: any) {
    if (config.volume !== undefined) {
      this.state.volume = Math.max(0, Math.min(1, Number(config.volume)));
      this.app.notify(this, { volume: this.state.volume });
    }
    if (config.generator !== undefined) {
      const g = config.generator;
      if (typeof g === "string") {
        this.state.generator = g as GeneratorType;
      } else if (g.type !== undefined) {
        this.state.generator = g.type;
        if (g.drumMap !== undefined) {
          this.state.drumMap = g.drumMap;
        }
        if (g.waveType !== undefined) {
          this.state.waveType = g.waveType;
        }
        if (g.duration !== undefined) {
          this.state.noteDuration = g.duration;
        }
      }
      this.app.notify(this, { generator: this.state.generator });
    }
    if (config.waveType !== undefined) {
      this.state.waveType = config.waveType;
      this.app.notify(this, { waveType: this.state.waveType });
    }
    if (config.drumMap !== undefined) {
      this.state.drumMap = config.drumMap;
    }
  }

  destroy() {
    this.ctx?.close();
    this.ctx = null;
    this.periodicWaveCache.clear();
  }

  process(params: any): any {
    if (!params) {
      return params;
    }

    const ctx = this.audioContext();

    // NoteFrame from game-of-life pipeline: { notes: NoteEvent[] }
    // Only synth mode can play frequency-based notes; drums mode requires note names.
    if (params.notes && Array.isArray(params.notes)) {
      if (this.state.generator === "synth") {
        const noteFrame = params as NoteFrame;
        for (const note of noteFrame.notes) {
          this.playSynthNote(
            ctx,
            note.frequency,
            note.velocity,
            note.duration / 1000,
          );
        }
      }
      return params;
    }

    // Array of note objects — either { note: string } or { frequency, velocity, duration }
    if (Array.isArray(params)) {
      for (const item of params) {
        if (item?.note) {
          this.playNoteByName(ctx, item.note);
        } else if (item?.frequency && this.state.generator === "synth") {
          this.playSynthNote(ctx, item.frequency, item.velocity ?? 1, (item.duration ?? 300) / 1000);
        }
      }
      return params;
    }

    // Single { note: string } object
    if (params.note) {
      this.playNoteByName(ctx, params.note);
    }

    return params;
  }

  // ── Private ──────────────────────────────────────────────────────────────

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

  private playNoteByName(ctx: AudioContext, note: string) {
    if (this.state.generator === "drums") {
      const drumType = this.state.drumMap[note];
      if (!drumType) {
        return;
      }
      switch (drumType) {
        case "kick":
          synthesizeKick(ctx, this.state.volume);
          break;
        case "snare":
          synthesizeSnare(ctx, this.state.volume);
          break;
        case "hihat":
          synthesizeHihat(ctx, this.state.volume);
          break;
      }
    } else {
      const freq = noteNameToFrequency(note);
      if (freq > 0) {
        this.playSynthNote(ctx, freq, 1, this.state.noteDuration);
      }
    }
  }

  private playSynthNote(
    ctx: AudioContext,
    frequency: number,
    velocity: number,
    durationSec: number,
  ) {
    const now = ctx.currentTime;
    const attack = 0.01;
    const release = 0.03;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (CUSTOM_WAVES[this.state.waveType]) {
      osc.setPeriodicWave(this.getPeriodicWave(ctx, this.state.waveType));
    } else {
      osc.type = this.state.waveType as OscillatorType;
    }
    osc.frequency.value = frequency;

    const peak = velocity * this.state.volume;
    const sustainEnd = Math.max(now + attack, now + durationSec - release);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.setValueAtTime(peak, sustainEnd);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
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
  ) => new Sound(app, board, descriptor, id),
  createUI: SoundUI,
};

export default descriptor;
