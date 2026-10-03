import { describe, expect, it } from "vitest";

import board from "../../../../boards/syn-mail-desk-board.json";
import unit from "../../../../boards/syn-mail-desk-unit-board.json";
import type { LayoutItem, SwimlaneWidget } from "../types";

function swimlanes(item: LayoutItem): SwimlaneWidget[] {
  if ("items" in item) {
    return item.items.flatMap(swimlanes);
  }
  return "type" in item && item.type === "swimlane"
    ? [item as SwimlaneWidget]
    : [];
}

describe("the SYN mail desk composition", () => {
  it("keeps the existing workflow units and replaces only their view", () => {
    expect(board.units.map((entry) => entry.uri)).toEqual([
      "syn-booking-unit-board.json",
      "syn-hotels-unit-board.json",
      "syn-mail-desk-unit-board.json",
    ]);
    expect(board.units.slice(0, 2).every((entry) => entry.view === false)).toBe(
      true,
    );
  });

  it("uses three independently configured swimlanes", () => {
    const lanes = unit.facade.panels.flatMap((panel) =>
      swimlanes(panel.layout as LayoutItem),
    );

    expect(lanes.map((lane) => lane.laneId)).toEqual([
      "incoming",
      "review",
      "waiting-reply",
    ]);
    expect(lanes[0]).toMatchObject({ allowDrag: false, acceptDrops: false });
    expect(lanes[1]).toMatchObject({
      allowDrag: true,
      acceptDrops: false,
      titleLabel: "Subject",
      descriptionLabel: "Body",
    });
    expect(lanes[2]).toMatchObject({ allowDrag: false, acceptDrops: true });
    expect(lanes[2].moveActions?.at(-1)).toMatchObject({
      type: "process",
      serviceUuid: "approve-draft",
    });
  });

  it("reads, edits and approves in the booking unit's named database", () => {
    const services = Object.values(unit.services).flat();
    const stateful = services.filter((service) =>
      ["sql", "conversations"].includes(service.serviceId),
    );

    expect(stateful.length).toBeGreaterThan(0);
    expect(stateful.every((service) => service.state.database === "syn-booking")).toBe(
      true,
    );
  });
});
