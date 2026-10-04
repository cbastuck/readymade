import { describe, expect, it } from "vitest";

import board from "../../../../boards/swimlanes-demo-board.json";
import type { LayoutItem, SwimlaneWidget } from "../types";

function widgets(item: LayoutItem): SwimlaneWidget[] {
  if ("items" in item && (!("type" in item) || item.type !== "repeat")) {
    return item.items.flatMap((child) => widgets(child as LayoutItem));
  }
  return "type" in item && item.type === "swimlane"
    ? [item as SwimlaneWidget]
    : [];
}

describe("the swimlanes demo board", () => {
  it("keeps move follow-up as an explicit extension point in the pipeline", () => {
    const services = board.services.work;
    expect(services.map((service) => service.uuid)).toEqual([
      "move-card",
      "after-move",
      "create-card",
      "edit-card",
      "delete-card",
      "read-board",
    ]);
    expect(services[1]).toMatchObject({
      serviceId: "sub-service",
      state: {
        pipeline: [
          {
            uuid: "move-event",
            serviceId: "monitor",
            serviceName: "Move event",
          },
        ],
      },
    });

    // Other operations enter after the hook. A create, edit or delete can
    // refresh the query at the end without pretending a card moved.
    const hook = services.findIndex((service) => service.uuid === "after-move");
    for (const uuid of ["create-card", "edit-card", "delete-card"]) {
      expect(services.findIndex((service) => service.uuid === uuid)).toBeGreaterThan(hook);
    }
  });

  it("passes every mutation's input onward to the shared refresh query", () => {
    const sql = board.services.work.filter(
      (service) => service.serviceId === "sql" && service.uuid !== "read-board",
    );
    expect(sql).toHaveLength(4);
    expect(sql.every((service) => service.state.emit === "input")).toBe(true);
    expect(
      board.services.work.every(
        (service) => service.serviceId === "sub-service" || service.state.database === "swimlanes-demo",
      ),
    ).toBe(true);
  });

  it("composes five independent lanes over the same rows", () => {
    const lanes = widgets(board.facade.panels[0].layout as LayoutItem);
    expect(lanes.map((lane) => lane.laneId)).toEqual([
      "backlog",
      "ready",
      "doing",
      "review",
      "done",
    ]);
    expect(lanes.every((lane) => lane.dragGroup === "work")).toBe(true);
    expect(
      lanes.every(
        (lane) =>
          lane.source.serviceUuid === "read-board" && lane.source.path === "rows",
      ),
    ).toBe(true);
    expect(lanes.filter((lane) => lane.allowCreate).map((lane) => lane.laneId)).toEqual([
      "backlog",
      "ready",
    ]);
    expect(
      lanes.every(
        (lane) =>
          lane.editActions?.length &&
          lane.deleteActions?.length &&
          lane.moveActions?.length,
      ),
    ).toBe(true);
  });
});
