/**
 * Tracks service — several pipelines over one input.
 *
 * The browser build runs the tracks in real nested scopes, so these are the
 * board's own arrangement end to end: what each track is given, what shape the
 * answers arrive in, and what the reducer can do with them.
 */

import { describe, expect, it, vi } from "vitest";
import TracksDescriptor from "../BrowserTracks";

function createTracks() {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
  };
  const service = TracksDescriptor.create(
    app as any,
    "test-board",
    {} as any,
    "tracks-1",
  ) as any;
  return { service, app };
}

/** A track of one Map, answering with `answer`.
 *
 * An object answer is a static template: the expression dialect has no object
 * literal, which is exactly the trap a board author meets here too. */
const answering = (name: string, answer: unknown) => ({
  name,
  pipeline: [
    {
      serviceId: "hookup.to/service/map",
      instanceId: name,
      serviceName: "Answer",
      state: {
        mode: "replace",
        template:
          answer && typeof answer === "object"
            ? (answer as Record<string, unknown>)
            : { "=": JSON.stringify(answer) },
      },
    },
  ],
});

const reducer = (term: string) => [
  {
    serviceId: "hookup.to/service/map",
    instanceId: "reduce-1",
    serviceName: "Reduce",
    state: { mode: "replace", arrayMode: "single", template: { "=": term } },
  },
];

describe("Tracks service", () => {
  it("exports the shared service id, so a board reads the same in any runtime", () => {
    expect(TracksDescriptor.serviceId).toBe("tracks");
  });

  it("gives every track the same input and answers in declaration order", async () => {
    const { service } = createTracks();
    service.configure({
      tracks: [
        {
          name: "keep",
          pipeline: [
            {
              serviceId: "hookup.to/service/map",
              instanceId: "keep",
              state: { mode: "replace", template: { saw: "keep", "intent=": "params.intent" } },
            },
          ],
        },
        {
          name: "drop",
          pipeline: [
            {
              serviceId: "hookup.to/service/map",
              instanceId: "drop",
              state: { mode: "replace", template: { saw: "drop", "intent=": "params.intent" } },
            },
          ],
        },
      ],
    });

    expect(await service.process({ intent: "keep" })).toEqual([
      { saw: "keep", intent: "keep" },
      { saw: "drop", intent: "keep" },
    ]);
  });

  it("hands on only the reduced answer, never a track's own", async () => {
    // A track's answer is collected for the reduce; pushing it onward as well
    // would reach the services after Tracks once per track, unreduced.
    const { service, app } = createTracks();
    service.configure({
      tracks: [answering("a", 1), answering("b", 2)],
      reduce: reducer("params.results[0] + params.results[1]"),
    });

    expect(await service.process({})).toBe(3);
    expect(app.next).not.toHaveBeenCalled();
  });

  it("leaves a hole where a track had nothing to say", async () => {
    const { service } = createTracks();
    service.configure({
      tracks: [
        {
          name: "quiet",
          pipeline: [
            {
              serviceId: "hookup.to/service/map",
              instanceId: "quiet",
              state: { mode: "replace", template: { "=": "null" } },
            },
          ],
        },
        answering("loud", { rows: 1 }),
      ],
    });

    // Position still names the track that produced it.
    expect(await service.process({})).toEqual([null, { rows: 1 }]);
  });

  it("hands the reducer what came in beside what the tracks answered", async () => {
    const { service } = createTracks();
    service.configure({
      tracks: [answering("keep", { rows: 1 })],
      reduce: reducer("params.input"),
    });

    // Carrying the input on is the commonest reduce there is: the tracks were
    // side effects, and what leaves is what came in.
    const input = { link: "https://example.test" };
    expect(await service.process(input)).toEqual(input);

    service.configure({ reduce: reducer("params.results[0].rows") });
    expect(await service.process(input)).toBe(1);
  });

  it("answers the array itself when no reducer is configured", async () => {
    const { service } = createTracks();
    service.configure({ tracks: [answering("a", 1), answering("b", 2)] });

    expect(await service.process({})).toEqual([1, 2]);
  });

  it("keeps declaration order when the tracks are run together", async () => {
    const { service } = createTracks();
    service.configure({
      run: "parallel",
      tracks: [answering("slow", "slow"), answering("quick", "quick")],
    });

    // How they ran is not something the next service should be able to tell.
    expect(await service.process({})).toEqual(["slow", "quick"]);
  });

  it("takes a pipeline edit aimed at one track", async () => {
    // What a panel sends when a service is added inside a track: the edit names
    // the track, and nothing beside it changes.
    const { service } = createTracks();
    service.configure({ tracks: [answering("a", 1), answering("b", 2)] });

    service.configure({
      track: "a",
      appendService: {
        serviceId: "hookup.to/service/map",
        instanceId: "a-2",
        state: { mode: "replace", template: { "=": "params + 10" } },
      },
    });

    expect(await service.process({})).toEqual([11, 2]);

    service.configure({ track: "a", removeService: "a-2" });
    expect(await service.process({})).toEqual([1, 2]);
  });

  it("reports what runs inside a track under the address through it", async () => {
    // Outside, an instanceId names nothing: two tracks may hold services of
    // one name, and so may the runtime. Whoever watches a nested service (the
    // overview) listens at `<tracks>.<instanceId>`, as it does inside a
    // SubService.
    const { service, app } = createTracks();
    service.configure({ tracks: [answering("a", 1)] });
    await service.process({});

    const states = app.notify.mock.calls
      .filter(([, n]) => n?.__internal)
      .map(([svc, n]) => [svc.address, n.__internal.state]);
    expect(states).toEqual([
      ["tracks-1.a", "call-process"],
      ["tracks-1.a", "call-process-finished"],
    ]);
  });

  it("passes its input through when bypassed", async () => {
    const { service } = createTracks();
    service.configure({ tracks: [answering("a", 1)] });
    service.configure({ bypass: true });

    expect(await service.process({ a: 1 })).toEqual({ a: 1 });
  });
});
