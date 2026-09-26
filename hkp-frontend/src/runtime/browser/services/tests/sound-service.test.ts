/**
 * Sound service — what plays for an input, and on which audio context.
 *
 * jsdom has no Web Audio, so a stub context records the nodes a sound builds:
 * a kick is one oscillator, a hi-hat one noise source through a high-pass
 * filter, a snare both a noise source and an oscillator.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SoundDescriptor from "../Sound";

class StubParam {
  value = 0;
  /** Every change scheduled, as [what, value, when]. */
  calls: Array<[string, number, number]> = [];
  setValueAtTime(value: number, time: number) {
    this.calls.push(["set", value, time]);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push(["exp", value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push(["linear", value, time]);
  }
}

class StubNode {
  frequency = new StubParam();
  gain = new StubParam();
  Q = new StubParam();
  type = "";
  buffer: unknown = null;
  stoppedAt: number | null = null;
  connect() {}
  start() {}
  stop(time: number) {
    this.stoppedAt = time;
  }
  setPeriodicWave() {}
}

let contexts: StubAudioContext[] = [];

class StubAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  created: string[] = [];
  gains: StubNode[] = [];
  oscillators: StubNode[] = [];
  constructor() {
    contexts.push(this);
  }
  createOscillator() {
    this.created.push("oscillator");
    const node = new StubNode();
    this.oscillators.push(node);
    return node;
  }
  createBufferSource() {
    this.created.push("noise");
    return new StubNode();
  }
  createBiquadFilter() {
    return new StubNode();
  }
  createGain() {
    const node = new StubNode();
    this.gains.push(node);
    return node;
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createPeriodicWave() {
    return {};
  }
  resume() {}
  close() {
    this.state = "closed";
  }
}

function createSound(slots?: Map<string, unknown>) {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    ...(slots ? { slots: () => slots } : {}),
  };
  const sound = SoundDescriptor.create(
    app as any,
    "test-board",
    {} as any,
    "sound-1",
  ) as any;
  return { sound, app };
}

beforeEach(() => {
  contexts = [];
  vi.useFakeTimers();
  vi.stubGlobal("AudioContext", StubAudioContext);
});

afterEach(() => {
  // Every test destroys its Sounds; this lets the deferred close happen, so the
  // next test opens a context of its own.
  vi.runAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Sound – trigger", () => {
  it("plays nothing for an input that names no note, when no trigger is set", () => {
    const { sound } = createSound();
    sound.process({ triggerCount: 1 });
    expect(contexts.flatMap((c) => c.created)).toEqual([]);
    sound.destroy();
  });

  it("plays the trigger drum for an input that names no note", () => {
    const { sound, app } = createSound();
    sound.configure({ trigger: "kick" });
    expect(app.notify).toHaveBeenCalledWith(sound, { trigger: "kick" });

    const tick = { triggerCount: 1 };
    // Passed through unchanged, so a chain of sounds can share one tick.
    expect(sound.process(tick)).toBe(tick);
    expect(contexts[0].created).toEqual(["oscillator"]);
    sound.destroy();
  });

  it("lets a note the input names win over the trigger", () => {
    const { sound } = createSound();
    sound.configure({ trigger: "kick" });
    sound.process({ note: "E4" }); // hi-hat in the default drum map
    expect(contexts[0].created).toEqual(["noise"]);
    sound.destroy();
  });

  it("plays a trigger note name in synth mode", () => {
    const { sound } = createSound();
    sound.configure({ generator: "synth", trigger: "A4" });
    sound.process({ triggerCount: 1 });
    expect(contexts[0].created).toEqual(["oscillator"]);
    sound.destroy();
  });

  it("clears the trigger when configured empty", () => {
    const { sound } = createSound();
    sound.configure({ trigger: "snare" });
    sound.configure({ trigger: null });
    expect(sound.state.trigger).toBeNull();
    sound.process({ triggerCount: 1 });
    expect(contexts.flatMap((c) => c.created)).toEqual([]);
    sound.destroy();
  });
});

describe("Sound – audio context", () => {
  it("opens the context when a Sound is created, before the first note", () => {
    // Opening one blocks while the audio device starts; paid on the first
    // note, that note would play late.
    const { sound } = createSound();
    expect(contexts).toHaveLength(1);
    sound.destroy();
  });

  it("shares one context across instances and closes it a while after the last", () => {
    const { sound: a } = createSound();
    const { sound: b } = createSound();
    a.configure({ trigger: "kick" });
    b.configure({ trigger: "snare" });
    a.process({});
    b.process({});
    expect(contexts).toHaveLength(1);

    a.destroy();
    b.destroy();
    expect(contexts[0].state).toBe("running");
    vi.advanceTimersByTime(5000);
    expect(contexts[0].state).toBe("closed");
  });

  it("keeps the context for a Sound created again soon after", () => {
    // A pipeline rebuilt around its Sounds destroys and recreates them; that
    // must not reopen the audio device.
    const { sound: a } = createSound();
    a.destroy();
    vi.advanceTimersByTime(1000);
    const { sound: b } = createSound();
    vi.advanceTimersByTime(10_000);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].state).toBe("running");
    b.destroy();
  });

  it("resumes a context opened before any gesture on the first one", () => {
    class SuspendedContext extends StubAudioContext {
      state = "suspended";
      resumed = 0;
      resume() {
        this.resumed += 1;
      }
    }
    vi.stubGlobal("AudioContext", SuspendedContext);
    const { sound } = createSound();
    const ctx = contexts[0] as SuspendedContext;
    const before = ctx.resumed;

    window.dispatchEvent(new Event("pointerdown"));
    expect(ctx.resumed).toBe(before + 1);
    // Once: the listener goes with the gesture that used it.
    window.dispatchEvent(new Event("pointerdown"));
    expect(ctx.resumed).toBe(before + 1);
    sound.destroy();
  });
});

describe("Sound – envelope", () => {
  it("rises over the attack, holds for the duration, then fades over the release", () => {
    const { sound } = createSound();
    sound.configure({
      generator: "synth",
      volume: 0.5,
      attack: 0.4,
      noteDuration: 2,
      release: 1,
    });
    sound.process({ note: "A3" });
    const [gain] = contexts[0].gains;
    expect(gain.gain.calls).toEqual([
      ["set", 0, 0],
      ["linear", 0.5, 0.4],
      ["set", 0.5, 2],
      ["linear", 0, 3],
    ]);
    // Sounding through its release, not cut at the end of the duration.
    expect(contexts[0].oscillators[0].stoppedAt).toBe(3);
    sound.destroy();
  });

  it("fades from where it got to when let go before the attack is over", () => {
    const { sound } = createSound();
    sound.configure({ generator: "synth", volume: 1, attack: 1, noteDuration: 0.25, release: 0.5 });
    sound.process({ note: "A3" });
    expect(contexts[0].gains[0].gain.calls).toEqual([
      ["set", 0, 0],
      ["linear", 0.25, 0.25],
      ["linear", 0, 0.75],
    ]);
    sound.destroy();
  });

  it("holds a note for beats of the tempo held in the tempo slot", () => {
    const slots = new Map<string, unknown>([["tempo", 90]]);
    const { sound, app } = createSound(slots);
    sound.configure({ generator: "synth", noteDuration: 3, noteDurationUnit: "beats", release: 0 });
    expect(app.notify).toHaveBeenCalledWith(sound, {
      noteDuration: 3,
      release: 0,
      noteDurationUnit: "beats",
    });
    sound.process({ note: "A3" });
    // Three beats at 90 BPM.
    expect(contexts[0].oscillators[0].stoppedAt).toBeCloseTo(2);
    // Read as each note starts: a tempo change applies to the next one.
    slots.set("tempo", 180);
    sound.process({ note: "A3" });
    expect(contexts[0].oscillators[1].stoppedAt).toBeCloseTo(1);
    sound.destroy();
  });

  it("plays a list of named notes, held in beats of the tempo it carries", () => {
    // A slot says 60, the input says 120: what came with the notes wins.
    const slots = new Map<string, unknown>([["tempo", 60]]);
    const { sound } = createSound(slots);
    sound.configure({ generator: "synth", noteDuration: 4, noteDurationUnit: "beats", release: 0 });
    sound.process({ notes: [{ note: "A3" }, { note: "C4" }], tempo: 120 });
    expect(contexts[0].oscillators.map((o) => o.stoppedAt)).toEqual([2, 2]);
    sound.destroy();
  });

  it("plays every note of a chord with the same envelope", () => {
    const { sound } = createSound();
    sound.configure({ generator: "synth", noteDuration: 1, release: 0.5 });
    sound.process([{ note: "A3" }, { note: "C4" }, { note: "E4" }]);
    expect(contexts[0].oscillators.map((o) => o.stoppedAt)).toEqual([1.5, 1.5, 1.5]);
    sound.destroy();
  });
});
