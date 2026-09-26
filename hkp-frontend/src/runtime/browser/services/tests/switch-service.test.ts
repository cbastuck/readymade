/**
 * Switch service tests
 *
 * Covers:
 *  - Case routing: first truthy `when` expression wins, input runs through
 *    that case's sub-pipeline
 *  - Default pipeline when no case matches
 *  - Pass-through when no case matches and no default is configured
 *    (backward compatible with the old identity Switch)
 *  - Empty matched pipeline passes input through
 *  - ignoreInnerResult returns the original input
 *  - A case is a branch, not a scope: it holds in the slots around the
 *    Switch, reports outward under <switch>.<instanceId>, and is reachable by
 *    that address; answering by returning only
 */

import { describe, it, expect, vi } from "vitest";
// The registry first, as the app loads it: Switch and the registry import each
// other, and entered from the Switch side the registry would list services
// that are not defined yet.
import "../../BrowserRegistry";
import SwitchDescriptor from "../Switch";
import { createSlotStore } from "../../../slots";

function createMockApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
    setRuntimeVariable: vi.fn(),
  };
}

function createSwitch() {
  const app = createMockApp();
  const service = SwitchDescriptor.create(
    app as any,
    "test-board",
    {} as any,
    "switch-1",
  ) as any;
  return { service, app };
}

const routeCase = (kind: string, route: string) => ({
  when: `params.kind == '${kind}'`,
  pipeline: [
    {
      serviceId: "hookup.to/service/map",
      serviceName: "Route",
      state: { mode: "replace", template: { route } },
    },
  ],
});

describe("Switch service", () => {
  it("exports the expected descriptor", () => {
    expect(SwitchDescriptor.serviceId).toBe("hookup.to/service/switch");
    expect(SwitchDescriptor.serviceName).toBe("Switch");
  });

  it("passes input through when unconfigured (legacy identity behavior)", async () => {
    const { service } = createSwitch();
    const input = { kind: "anything" };
    expect(await service.process(input)).toBe(input);
  });

  it("routes into the first matching case's pipeline", async () => {
    const { service } = createSwitch();
    service.configure({
      cases: [routeCase("a", "A"), routeCase("b", "B")],
      default: [
        {
          serviceId: "hookup.to/service/map",
          state: { mode: "replace", template: { route: "D" } },
        },
      ],
    });

    expect(await service.process({ kind: "a" })).toEqual({ route: "A" });
    expect(await service.process({ kind: "b" })).toEqual({ route: "B" });
    expect(await service.process({ kind: "?" })).toEqual({ route: "D" });
  });

  it("passes through when no case matches and no default is configured", async () => {
    const { service } = createSwitch();
    service.configure({ cases: [routeCase("a", "A")] });
    const input = { kind: "z" };
    expect(await service.process(input)).toBe(input);
  });

  it("passes through a matched case with an empty pipeline", async () => {
    const { service } = createSwitch();
    service.configure({ cases: [{ when: "params.kind == 'a'", pipeline: [] }] });
    const input = { kind: "a" };
    expect(await service.process(input)).toBe(input);
  });

  it("ignoreInnerResult returns the original input after routing", async () => {
    const { service } = createSwitch();
    service.configure({
      cases: [routeCase("a", "A")],
      ignoreInnerResult: true,
    });
    const input = { kind: "a" };
    expect(await service.process(input)).toBe(input);
  });

  it("skips cases with syntax-error conditions instead of throwing", async () => {
    const { service } = createSwitch();
    service.configure({
      cases: [
        { when: "params.kind ===== broken", pipeline: [] },
        routeCase("a", "A"),
      ],
    });
    expect(await service.process({ kind: "a" })).toEqual({ route: "A" });
  });

  it("supports branch-scoped pipeline ops (append / remove / when)", async () => {
    const { service } = createSwitch();
    service.configure({
      cases: [{ when: "params.kind == 'a'", pipeline: [] }],
      default: [],
    });

    // Append a map into case 0 — routing must now transform.
    service.configure({
      branch: 0,
      appendService: {
        serviceId: "hookup.to/service/map",
        instanceId: "case-map",
        state: { mode: "replace", template: { route: "A" } },
      },
    });
    expect(await service.process({ kind: "a" })).toEqual({ route: "A" });

    // Append into the default branch.
    service.configure({
      branch: "default",
      appendService: {
        serviceId: "hookup.to/service/map",
        instanceId: "default-map",
        state: { mode: "replace", template: { route: "D" } },
      },
    });
    expect(await service.process({ kind: "z" })).toEqual({ route: "D" });

    // Rewrite the case condition through the branch op.
    service.configure({ branch: 0, when: "params.kind == 'b'" });
    expect(await service.process({ kind: "b" })).toEqual({ route: "A" });
    expect(await service.process({ kind: "a" })).toEqual({ route: "D" });

    // Remove the case's service — matched case with empty pipeline passes through.
    service.configure({ branch: 0, removeService: "case-map" });
    const input = { kind: "b" };
    expect(await service.process(input)).toBe(input);
  });

  it("branches the next-bus-switch board's exact configuration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T11:24:00+02:00"));
    try {
      const { service } = createSwitch();
      service.configure({
        cases: [
          {
            when: "params.next",
            pipeline: [
              {
                serviceId: "hookup.to/service/map",
                state: {
                  mode: "replace",
                  template: {
                    "text=":
                      "'The bus leaves in ' + moment(params.next.when).diff(moment(), 'minutes') + ' minutes at ' + moment(params.next.when).format('HH:mm') + '.'",
                  },
                },
              },
            ],
          },
        ],
        default: [
          {
            serviceId: "hookup.to/service/map",
            state: {
              mode: "replace",
              template: { text: "I found no upcoming departures." },
            },
          },
        ],
      });

      const found = (await service.process({
        next: { tripId: "1|2|3", when: "2026-07-18T11:36:00+02:00" },
      })) as any;
      expect(found.text).toBe("The bus leaves in 12 minutes at 11:36.");

      const none = (await service.process({ next: undefined })) as any;
      expect(none.text).toBe("I found no upcoming departures.");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Switch service – a case is a branch of the pipeline around it", () => {
  const holdCase = (op: "read" | "write") => ({
    when: "true",
    pipeline: [
      {
        serviceId: "hookup.to/service/hold",
        instanceId: `hold-${op}`,
        state: { slot: "shared", op },
      },
    ],
  });

  it("holds in the slots of whatever holds the Switch", async () => {
    const slots = createSlotStore();
    const app = { ...createMockApp(), slots: () => slots };
    const service = SwitchDescriptor.create(app as any, "b", {} as any, "sw") as any;
    service.configure({ cases: [holdCase("write")] });

    await service.process({ written: true });
    expect(slots.get("shared")).toEqual({ written: true });
  });

  it("reports outward under its address, answers by returning only, and is found by it", async () => {
    const { service, app } = createSwitch();
    service.configure({ cases: [routeCase("a", "A")] });
    service.configure({
      cases: [
        {
          when: "true",
          pipeline: [
            {
              serviceId: "hookup.to/service/map",
              instanceId: "route",
              state: { mode: "replace", template: { route: "A" } },
            },
          ],
        },
      ],
    });

    expect(await service.process({})).toEqual({ route: "A" });
    expect(app.next).not.toHaveBeenCalled();
    const addresses = app.notify.mock.calls.map(([svc]: any[]) => svc.address);
    expect(addresses).toContain("switch-1.route");
    expect(service.findNested("route")).toBe(service.getInnerInstance("route"));
  });
});
