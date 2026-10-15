import { expect, it } from "vitest";
import { matchesAssistSnapshot } from "./snapshotComparison";

const timer = (counter: number, periodicValue = 1) => ({
  serviceId: "hookup.to/service/timer", uuid: "timer",
  state: { periodic: true, periodicValue, periodicUnit: "minutes", counter, running: true },
});
const snapshot = (service: unknown) => ({
  config: { runtimes: [{ id: "ui", type: "browser", name: "Browser" }], services: { ui: [service] } }, units: [],
});
it("allows Timer ticks without mutating the board's saved counter", () => {
  const current = snapshot(timer(42));
  expect(matchesAssistSnapshot(current, JSON.stringify(snapshot(timer(1))))).toBe(true);
  expect(current.config.services.ui[0]).toEqual(timer(42));
});
it("still blocks timer configuration changes and changes to other services' counters", () => {
  expect(matchesAssistSnapshot(snapshot(timer(2, 5)), JSON.stringify(snapshot(timer(1))))).toBe(false);
  const service = (counter: number) => ({ serviceId: "custom", state: { counter } });
  expect(matchesAssistSnapshot(snapshot(service(2)), JSON.stringify(snapshot(service(1))))).toBe(false);
});
it("handles timers inside nested pipelines and imported units", () => {
  const nested = (counter: number) => ({ config: {}, units: [{ board: snapshot({ serviceId: "sub-service", state: { pipeline: [timer(counter)] } }).config }] });
  expect(matchesAssistSnapshot(nested(3), JSON.stringify(nested(1)))).toBe(true);
});
it("ignores object key ordering but preserves service ordering", () => {
  expect(matchesAssistSnapshot({ a: 1, b: 2 }, '{"b":2,"a":1}')).toBe(true);
  expect(matchesAssistSnapshot([1, 2], '[2,1]')).toBe(false);
});
