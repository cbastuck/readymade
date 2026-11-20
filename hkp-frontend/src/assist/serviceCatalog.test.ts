import { expect, it } from "vitest";
import { BoardDescriptor } from "../types";
import { unknownServices } from "./serviceCatalog";

const svc = (uuid: string, serviceId: string, state?: unknown) => ({
  uuid,
  serviceId,
  serviceName: uuid,
  ...(state ? { state } : {}),
});
const node = { id: "node", name: "Node", type: "rest", remote: "node" };
const running = {
  runtimes: [node] as any,
  registry: { node: [{ serviceId: "sql" }, { serviceId: "monitor" }] },
};
const boardOf = (services: BoardDescriptor["services"], runtimes: unknown[] = [
  { id: "ui", name: "UI", type: "browser" },
  node,
]) => ({ runtimes, services }) as unknown as BoardDescriptor;

it("finds a browser service that does not exist, nested pipelines included", async () => {
  const board = boardOf({
    ui: [
      svc("timer", "hookup.to/service/timer"),
      svc("sub", "sub-service", {
        pipeline: [{ instanceId: "store", serviceId: "hookup.to/service/storage" }],
      }),
    ],
    node: [],
  });
  expect(await unknownServices(board, running)).toEqual([
    { runtimeId: "ui", uuid: "store", serviceId: "hookup.to/service/storage" },
  ]);
});

it("holds a runtime the board already runs to what its server reported", async () => {
  const board = boardOf({ ui: [], node: [svc("db", "sql"), svc("x", "storage")] });
  expect(await unknownServices(board, running)).toEqual([
    { runtimeId: "node", uuid: "x", serviceId: "storage" },
  ]);
});

it("leaves alone a server runtime whose services are not known here", async () => {
  const moved = { ...node, remote: "python" };
  const board = boardOf({ ui: [], node: [svc("x", "storage")] }, [moved]);
  expect(await unknownServices(board, running)).toEqual([]);
});

it("holds a proposal only to what it adds", async () => {
  const base = boardOf({ ui: [svc("old", "gone")], node: [] });
  const board = boardOf({ ui: [svc("old", "gone"), svc("new", "also-gone")], node: [] });
  expect(await unknownServices(board, running, base)).toEqual([
    { runtimeId: "ui", uuid: "new", serviceId: "also-gone" },
  ]);
});

it("skips block uses, which are checked where they are defined", async () => {
  const board = boardOf({ ui: [{ uuid: "b", block: "my-block" } as any], node: [] });
  expect(await unknownServices(board, running)).toEqual([]);
});
