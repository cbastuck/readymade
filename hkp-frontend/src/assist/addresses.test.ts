import { describe, expect, it } from "vitest";
import {
  hasNewAddresses,
  nameKeptServers,
  newAddresses,
  unencryptedRemote,
} from "./addresses";
import { BoardDescriptor } from "../types";

const current = {
  config: {
    runtimes: [
      { id: "ui", name: "Browser", type: "browser" },
      { id: "node", name: "Node", type: "rest", url: "https://rt.example:8080" },
    ],
    services: {
      ui: [{ uuid: "ws", serviceId: "websocket-client", state: { url: "wss://feed.example/ws" } }],
    },
  },
  units: [{ uri: "helper", board: { runtimes: [{ url: "http://127.0.0.1:9000" }] } }],
};

describe("addresses a proposal contacts", () => {
  it("accepts addresses the board already contacts", () => {
    const proposed = {
      ...current.config,
      runtimes: [
        ...current.config.runtimes,
        { id: "more", name: "More", type: "rest", url: "https://rt.example:8080/other" },
        { id: "unit", name: "Unit", type: "rest", url: "http://127.0.0.1:9000" },
      ],
    };
    expect(hasNewAddresses(newAddresses(current, proposed))).toBe(false);
  });

  it("names a repointed runtime and a new service address separately", () => {
    const proposed = {
      runtimes: [
        { id: "ui", name: "Browser", type: "browser" },
        { id: "node", name: "Node", type: "rest", url: "https://evil.example" },
      ],
      services: {
        ui: [
          { uuid: "ws", serviceId: "websocket-client", state: { url: "wss://feed.example/ws" } },
          { uuid: "post", serviceId: "http", state: { url: " https://collect.example/x " } },
        ],
      },
    };
    expect(newAddresses(current, proposed)).toEqual({
      runtimes: ["https://evil.example"],
      services: ["https://collect.example"],
    });
  });

  it("treats another port as another server", () => {
    const proposed = {
      ...current.config,
      runtimes: [{ id: "node", name: "Node", type: "rest", url: "https://rt.example:9999" }],
    };
    expect(newAddresses(current, proposed).runtimes).toEqual([
      "https://rt.example:9999",
    ]);
  });

  it("ignores references and text that only mention an address", () => {
    const proposed = {
      ...current.config,
      services: {
        ui: [
          { uuid: "a", serviceId: "x", state: { url: "hkp-mount://node/server" } },
          { uuid: "b", serviceId: "x", state: { note: "see https://docs.example for more" } },
        ],
      },
    };
    expect(hasNewAddresses(newAddresses(current, proposed))).toBe(false);
  });
});

describe("unencrypted addresses", () => {
  it("warns about plain HTTP to another machine only", () => {
    expect(unencryptedRemote("http://192.168.1.20:8080/v1")).toBe(true);
    expect(unencryptedRemote("http://models.example/v1")).toBe(true);
    expect(unencryptedRemote("https://models.example/v1")).toBe(false);
    expect(unencryptedRemote("http://127.0.0.1:8081/v1")).toBe(false);
    expect(unencryptedRemote("http://localhost:8081")).toBe(false);
    expect(unencryptedRemote("http://[::1]:8081")).toBe(false);
    expect(unencryptedRemote("not a url")).toBe(false);
  });
});

describe("naming kept servers", () => {
  const remotes = [
    { name: "Laptop", url: "http://127.0.0.1:8080", type: "rest", aliases: ["node"] },
    { name: "Studio", url: "https://studio.example", type: "rest" },
    { name: "meander-cpp", url: "hkp://remotes/meander-cpp", type: "rest" },
  ];
  const current = {
    runtimes: [
      { id: "old", name: "Old", type: "rest", url: "https://studio.example" },
    ],
    services: { old: [] },
  } as unknown as BoardDescriptor;

  it("replaces a model-written address of a kept server with its portable name", () => {
    const proposed = {
      runtimes: [
        ...current.runtimes,
        { id: "n", name: "Node", type: "rest", url: "http://127.0.0.1:8080/" },
        { id: "s", name: "Studio", type: "rest", url: "https://studio.example" },
        { id: "e", name: "Audio", type: "rest", url: "hkp://remotes/meander-cpp" },
        { id: "x", name: "Other", type: "rest", url: "https://unknown.example" },
      ],
      services: { old: [], n: [], s: [], e: [], x: [] },
    } as unknown as BoardDescriptor;
    const { board, renamed } = nameKeptServers(current, proposed, remotes);
    expect(renamed).toEqual([
      { runtimeId: "n", remote: "node" },
      { runtimeId: "s", remote: "Studio" },
      { runtimeId: "e", remote: "embedded" },
    ]);
    expect(board.runtimes[1]).toEqual({ id: "n", name: "Node", type: "rest", remote: "node" });
    // Already addressed this way in the current board: the person's call.
    expect(board.runtimes[0]).toBe(current.runtimes[0]);
    expect(board.runtimes[4].url).toBe("https://unknown.example");
  });

  it("leaves a proposal without kept addresses untouched", () => {
    const { board, renamed } = nameKeptServers(current, current, remotes);
    expect(board).toBe(current);
    expect(renamed).toEqual([]);
  });
});
