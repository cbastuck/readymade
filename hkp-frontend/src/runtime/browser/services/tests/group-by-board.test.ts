import { describe, expect, it, vi } from "vitest";

import board from "../../../../../../boards/group-by-demo-board.json";
import GroupByDescriptor from "../base/GroupBy";
import MapDescriptor from "../base/Map";

const app = () => ({
  notify: vi.fn(),
  next: vi.fn(),
  sendAction: vi.fn(),
  processRuntimeByName: vi.fn(),
  getRuntimeVariable: vi.fn(() => ({})),
  setRuntimeVariable: vi.fn(),
});

describe("the Group By demo board", () => {
  it("builds its sample array and produces the documented histogram", async () => {
    const sample = board.services.ui.find(({ uuid }) => uuid === "data-svc")!;
    const grouping = board.services.ui.find(({ uuid }) => uuid === "groupby-svc")!;
    const map = new MapDescriptor.Map(
      app() as any,
      board.boardName,
      {} as any,
      sample.uuid,
    );
    const groupBy = new GroupByDescriptor.GroupBy(
      app() as any,
      board.boardName,
      {} as any,
      grouping.uuid,
    );

    await map.configure(sample.state);
    groupBy.configure(grouping.state);

    expect(await groupBy.process(await map.process({ triggerCount: 1 }))).toEqual({
      A: 4,
      B: 3,
      C: 2,
    });
  });
});
