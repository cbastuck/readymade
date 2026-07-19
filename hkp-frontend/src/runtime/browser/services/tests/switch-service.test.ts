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
 */

import { describe, it, expect, vi } from "vitest";
import SwitchDescriptor from "../Switch";

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
