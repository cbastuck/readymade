import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardSnapshot, createSnapshotScheduler } from "../boardSnapshots";
import { withEditReporting } from "../editedServices";
import { ServiceInstance } from "../../types";

/** A board whose one service's configuration the test sets directly. */
function setup() {
  const board = { value: 0 };
  const written: BoardSnapshot[] = [];
  const serialize = vi.fn(async () => ({
    boardName: "b",
    documents: {
      composition: {
        runtimes: [],
        services: { rt: [{ uuid: "s", state: { value: board.value } }] },
      } as any,
      units: [],
    },
  }));
  const scheduler = createSnapshotScheduler({
    serialize,
    write: (snapshot) => written.push(snapshot),
    maxWaitMs: 10000,
  });
  return { board, written, serialize, scheduler };
}

/** Lets the scheduler's promise chain run after a timer fired it. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe("createSnapshotScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes one snapshot once changes pause", async () => {
    const { board, written, serialize, scheduler } = setup();
    for (let i = 1; i <= 50; i++) {
      board.value = i;
      scheduler.schedule("configuration", 2000);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(written).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2000);
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(1);
    expect(written[0].reason).toBe("configuration");
    expect(
      written[0].documents.composition.services.rt[0].state,
    ).toEqual({ value: 50 });
  });

  it("still writes at the max wait while changes never pause", async () => {
    const { board, written, scheduler } = setup();
    for (let i = 1; i <= 120; i++) {
      board.value = i;
      scheduler.schedule("configuration", 2000);
      await vi.advanceTimersByTimeAsync(100);
    }
    // 12 s of changes 100 ms apart: one write at 10 s, none since.
    expect(written).toHaveLength(1);
  });

  it("does not write a snapshot identical to the last one", async () => {
    const { board, written, serialize, scheduler } = setup();
    board.value = 1;
    scheduler.schedule("configuration", 2000);
    await vi.advanceTimersByTimeAsync(2000);
    scheduler.schedule("configuration", 2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(serialize).toHaveBeenCalledTimes(2);
    expect(written).toHaveLength(1);
  });

  it("labels a snapshot structural when any request was", async () => {
    const { written, scheduler } = setup();
    scheduler.schedule("structure", 500);
    scheduler.schedule("configuration", 2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(written.map((s) => s.reason)).toEqual(["structure"]);
  });

  it("writes what is pending on flush, and nothing after cancel", async () => {
    const { board, written, scheduler } = setup();
    board.value = 7;
    scheduler.schedule("configuration", 2000);
    await scheduler.flush();
    expect(written).toHaveLength(1);

    board.value = 8;
    scheduler.schedule("configuration", 2000);
    scheduler.cancel();
    await vi.advanceTimersByTimeAsync(20000);
    await settle();
    expect(written).toHaveLength(1);
  });
});

describe("createSnapshotScheduler rebase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the snapshot of a board just opened as the baseline", async () => {
    const { board, written, scheduler } = setup();
    scheduler.rebase();
    scheduler.schedule("structure", 500);
    await vi.advanceTimersByTimeAsync(500);
    expect(written).toHaveLength(0);

    board.value = 1;
    scheduler.schedule("configuration", 2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(written).toHaveLength(1);
  });

  it("writes when a person changed the board before the baseline", async () => {
    const { written, scheduler } = setup();
    scheduler.rebase();
    scheduler.schedule("structure", 500);
    scheduler.schedule("configuration", 2000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(written.map((s) => s.reason)).toEqual(["structure"]);
  });
});

describe("withEditReporting", () => {
  class Service {
    uuid = "svc";
    state = { value: 0 };
    configure(config: { value: number }) {
      this.state.value = config.value;
    }
    current() {
      return this.state.value;
    }
  }

  it("reports a configure after it reached the service", async () => {
    const service = new Service();
    const onEdit = vi.fn(() => {
      expect(service.state.value).toBe(3);
    });
    const edited = withEditReporting(
      service as unknown as ServiceInstance,
      onEdit,
    );

    edited.configure({ value: 3 });
    await Promise.resolve();

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("is otherwise the service itself", () => {
    const service = new Service();
    const edited = withEditReporting(
      service as unknown as ServiceInstance,
      () => {},
    ) as unknown as Service;

    service.configure({ value: 5 });
    expect(edited.uuid).toBe("svc");
    expect(edited.current()).toBe(5);
    expect(edited.state).toBe(service.state);
  });

  it("does not report configure calls made on the service directly", async () => {
    const service = new Service();
    const onEdit = vi.fn();
    withEditReporting(service as unknown as ServiceInstance, onEdit);

    // What a Configurator does: it holds the service, not the panel's view.
    service.configure({ value: 9 });
    await Promise.resolve();

    expect(onEdit).not.toHaveBeenCalled();
  });
});
