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
 * Config: generator.type ("synth" | "drums"), volume, waveType, noteDuration, trigger
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
 *
 * trigger — what to play for an input that names no note of its own (e.g. a
 *           Timer tick): a note name, or in drums mode also a drum name.
 *           Unset, such an input plays nothing.
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
export const DRUM_TYPES: DrumType[] = ["kick", "snare", "hihat"];

type State = {
  volume: number;
  generator: GeneratorType;
  waveType: WaveType;
  noteDuration: number; // seconds, used in synth mode
  drumMap: Record<string, DrumType>; // note name → drum type
  trigger: string | null; // played for input that names no note
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

// ── Shared audio context ─────────────────────────────────────────────────────

// One context for every Sound instance: each context is its own audio graph and
// output stream, and browsers cap how many may be open at once.
//
// Opened as soon as a Sound exists rather than on the first note: constructing
// a context opens the audio device, which blocks for a noticeable time (~150 ms
// measured in Chromium), and paid on the first note that is a first note played
// late. A context opened before the page has had a user gesture starts
// suspended, so it is resumed on the first gesture anywhere on the page — the
// press that starts playback, at the latest.
//
// Closed a while after the last instance is destroyed rather than at once, so
// a pipeline rebuilt around its Sounds does not reopen the device.
let sharedCtx: AudioContext | null = null;
const periodicWaveCache = new Map<string, PeriodicWave>();
const liveInstances = new Set<object>();
const CLOSE_AFTER_MS = 5000;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

function resumeOnGesture() {
  if (sharedCtx?.state === "suspended") {
    sharedCtx.resume();
  }
  for (const gesture of GESTURES) {
    window.removeEventListener(gesture, resumeOnGesture, true);
  }
}

function sharedAudioContext(): AudioContext {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext({ latencyHint: "interactive" });
    periodicWaveCache.clear();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume();
  }
  return sharedCtx;
}

/** Opens the shared context ahead of the first note, where the page has audio. */
function warmAudioContext() {
  if (typeof AudioContext === "undefined") {
    return;
  }
  const ctx = sharedAudioContext();
  if (ctx.state === "suspended" && typeof window !== "undefined") {
    for (const gesture of GESTURES) {
      window.addEventListener(gesture, resumeOnGesture, true);
    }
  }
}

function releaseAudioContext(owner: object) {
  liveInstances.delete(owner);
  if (liveInstances.size > 0 || !sharedCtx || closeTimer) {
    return;
  }
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (liveInstances.size === 0 && sharedCtx) {
      sharedCtx.close();
      sharedCtx = null;
      periodicWaveCache.clear();
    }
  }, CLOSE_AFTER_MS);
}

// ── Service ──────────────────────────────────────────────────────────────────

class Sound extends ServiceBase<State> {
  private reportedLatencyMs: number | null = null;

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
      trigger: null,
    });
    liveInstances.add(this);
    warmAudioContext();
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
    if (config.trigger !== undefined) {
      this.state.trigger = config.trigger || null;
      this.app.notify(this, { trigger: this.state.trigger });
    }
  }

  destroy() {
    releaseAudioContext(this);
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
    } else if (this.state.trigger) {
      this.playTrigger(ctx, this.state.trigger);
    }

    this.reportLatency(ctx);
    return params;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * How long after a note starts it is heard, as the browser reports it: the
   * context's own buffering plus the output device's. Reported when it
   * changes; a Bluetooth device typically adds far more than wired speakers.
   */
  private reportLatency(ctx: AudioContext) {
    const ms = Math.round(
      ((ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0)) * 1000,
    );
    if (ms !== this.reportedLatencyMs) {
      this.reportedLatencyMs = ms;
      this.app.notify(this, { outputLatencyMs: ms });
    }
  }

  private audioContext(): AudioContext {
    return sharedAudioContext();
  }

  private getPeriodicWave(ctx: AudioContext, name: string): PeriodicWave {
    if (!periodicWaveCache.has(name)) {
      const { real, imag } = CUSTOM_WAVES[name];
      periodicWaveCache.set(
        name,
        ctx.createPeriodicWave(new Float32Array(real), new Float32Array(imag)),
      );
    }
    return periodicWaveCache.get(name)!;
  }

  private playTrigger(ctx: AudioContext, trigger: string) {
    if (
      this.state.generator === "drums" &&
      DRUM_TYPES.includes(trigger as DrumType)
    ) {
      this.playDrum(ctx, trigger as DrumType);
    } else {
      this.playNoteByName(ctx, trigger);
    }
  }

  private playDrum(ctx: AudioContext, drumType: DrumType) {
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
  }

  private playNoteByName(ctx: AudioContext, note: string) {
    if (this.state.generator === "drums") {
      const drumType = this.state.drumMap[note];
      if (!drumType) {
        return;
      }
      this.playDrum(ctx, drumType);
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
