import { describe, expect, it } from "vitest";

import { createPartnerBoard, hasPeerService } from "../partnerBoard";
import { BoardDescriptor } from "hkp-frontend/src/types";

const peerSvc = (uuid: string, state: any) =>
  ({
    uuid,
    serviceId: "hookup.to/service/peer-socket",
    serviceName: "Peer Socket",
    state,
  }) as any;

const board = (): BoardDescriptor => ({
  boardName: "chat",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" } as any,
    {
      id: "local",
      name: "Local",
      type: "rest",
      url: "http://127.0.0.1:8080",
    } as any,
    {
      id: "far",
      name: "Far",
      type: "rest",
      url: "https://rt.example.com",
    } as any,
  ],
  services: {
    ui: [peerSvc("peer", { peerName: "alice", targetPeer: "bob", room: "r1" })],
    local: [
      { uuid: "srv", serviceId: "monitor", serviceName: "Monitor" } as any,
    ],
    far: [
      { uuid: "far-svc", serviceId: "monitor", serviceName: "Monitor" } as any,
    ],
  },
  facade: { layout: "single", panels: [] },
});

const identity = <T>(b: T) => b;

describe("hasPeerService", () => {
  it("is true only when a peer-socket service is present", () => {
    expect(hasPeerService(board().services)).toBe(true);
    expect(
      hasPeerService({ ui: [{ uuid: "a", serviceId: "monitor" } as any] }),
    ).toBe(false);
    expect(hasPeerService({})).toBe(false);
  });
});

describe("createPartnerBoard", () => {
  it("swaps peerName and targetPeer, keeping the rest of the state", () => {
    const partner = createPartnerBoard(board(), identity);
    expect(partner.services.ui[0].state).toEqual({
      peerName: "bob",
      targetPeer: "alice",
      room: "r1",
    });
  });

  it("drops localhost runtimes and their services, keeping reachable ones", () => {
    const partner = createPartnerBoard(board(), identity);
    expect(partner.runtimes.map((rt) => rt.id)).toEqual(["ui", "far"]);
    expect(Object.keys(partner.services).sort()).toEqual(["far", "ui"]);
  });

  it("carries the facade and resolves mounts against the whole board", () => {
    let seen: any = null;
    const partner = createPartnerBoard(board(), (b) => {
      seen = b;
      return b;
    });
    expect(seen).not.toBeNull();
    expect(partner.facade).toEqual({ layout: "single", panels: [] });
  });

  it("leaves a peer service with no names alone rather than throwing", () => {
    const src = board();
    src.services.ui = [peerSvc("peer", undefined)];
    const partner = createPartnerBoard(src, identity);
    expect(partner.services.ui[0].state).toEqual({
      peerName: undefined,
      targetPeer: undefined,
    });
  });
});
