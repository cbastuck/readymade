import { describe, expect, it, vi } from "vitest";
import FilterDescriptor, {
  normalizeFilterConditions,
} from "../base/Filter";

function createFilter() {
  const app = { notify: vi.fn() };
  const service = new FilterDescriptor.Filter(
    app as any,
    "test-board",
    {} as any,
    "filter-1",
  );
  return { app, service };
}

describe("Filter condition configuration", () => {
  it("canonicalizes the documented single-string form to an array", () => {
    const { app, service } = createFilter();

    service.configure({ conditions: "params.enabled === true" });

    expect(service.conditions).toEqual(["params.enabled === true"]);
    expect(app.notify).toHaveBeenCalledWith(service, {
      conditions: ["params.enabled === true"],
    });
  });

  it("turns malformed condition state into a safe empty list", () => {
    expect(normalizeFilterConditions({ expression: "params.enabled" })).toEqual(
      [],
    );
    expect(normalizeFilterConditions(["params.enabled", 42, null])).toEqual([
      "params.enabled",
    ]);
  });
});
