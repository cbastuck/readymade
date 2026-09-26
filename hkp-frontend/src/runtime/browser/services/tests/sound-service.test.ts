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
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
}

class StubNode {
  frequency = new StubParam();
  gain = new StubParam();
  Q = new StubParam();
  type = "";
  buffer: unknown = null;
  connect() {}
  start() {}
  stop() {}
  setPeriodicWave() {}
}

let contexts: StubAudioContext[] = [];

class StubAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  created: string[] = [];
  constructor() {
    contexts.push(this);
  }
  createOscillator() {
    this.created.push("oscillator");
    return new StubNode();
  }
  createBufferSource() {
    this.created.push("noise");
    return new StubNode();
  }
  createBiquadFilter() {
    return new StubNode();
  }
  createGain() {
    return new StubNode();
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

function createSound() {
  const app = { notify: vi.fn(), next: vi.fn(), sendAction: vi.fn() };
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
