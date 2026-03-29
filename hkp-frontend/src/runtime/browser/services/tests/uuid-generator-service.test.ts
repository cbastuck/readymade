/**
 * UuidGenerator service tests
 *
 * Covers:
 *  - Descriptor shape
 *  - Default state and constructor behavior
 *  - configure() method switching (v4 <-> v1)
 *  - configure({ action: "generate" }) command behavior
 *  - process() output for plain and merge modes
 *  - notify/next contracts
 *  - getConfiguration() contract inherited from ServiceBase
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("uuid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("uuid")>();
  return {
    ...actual,
    v4: vi.fn(() => "mock-v4-uuid"),
    v1: vi.fn(() => "mock-v1-uuid"),
  };
});

import UuidGeneratorDescriptor from "../UuidGenerator";

type MockApp = {
  notify: ReturnType<typeof vi.fn>;
  next: ReturnType<typeof vi.fn>;
  sendAction: ReturnType<typeof vi.fn>;
};

const UuidGeneratorService = UuidGeneratorDescriptor.create;

function createMockApp(): MockApp {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
  };
}

function createService() {
  const app = createMockApp();
  const service = UuidGeneratorService(
    app as any,
    "test-board",
    UuidGeneratorDescriptor as any,
    "uuid-gen-1",
  );
  return { service, app };
}

describe("UuidGenerator descriptor", () => {
  it("exports serviceName and serviceId", () => {
    expect(UuidGeneratorDescriptor.serviceName).toBe("Uuid Generator");
    expect(UuidGeneratorDescriptor.serviceId).toBe(
      "hookup.to/service/uuid-generator",
    );
  });

  it("exposes create and createUI", () => {
    expect(typeof UuidGeneratorDescriptor.create).toBe("function");
    expect(UuidGeneratorDescriptor.createUI).toBeDefined();
  });
});

describe("UuidGenerator service default state", () => {
  it("starts with method v4 and mode plain", async () => {
    const { service } = createService();
    const cfg = await service.getConfiguration();
    expect(cfg.method).toBe("v4");
    expect(cfg.mode).toBe("plain");
  });

  it("starts with generated v4 uuid", async () => {
    const { service } = createService();
    const cfg = await service.getConfiguration();
    expect(cfg.uuid).toBe("mock-v4-uuid");
  });

  it("stores runtime identity fields", () => {
    const { service } = createService();
    expect(service.uuid).toBe("uuid-gen-1");
    expect(service.board).toBe("test-board");
    expect(typeof service.process).toBe("function");
    expect(typeof service.configure).toBe("function");
  });
});

describe("UuidGenerator configure()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps v4 generator when configured with same method", async () => {
    const { service, app } = createService();

    await service.configure({ method: "v4" });
    const out = service.process({});

    expect(out).toBe("mock-v4-uuid");
    expect(app.notify).toHaveBeenCalledWith(service, { method: "v4" });
  });

  it("switches to v1 generator when method changes", async () => {
    const { service, app } = createService();

    await service.configure({ method: "v1" });
    const out = service.process({});

    expect(out).toBe("mock-v1-uuid");
    expect(app.notify).toHaveBeenCalledWith(service, { method: "v1" });
  });

  it("switches back to v4 after v1", async () => {
    const { service } = createService();

    await service.configure({ method: "v1" });
    expect(service.process({})).toBe("mock-v1-uuid");

    await service.configure({ method: "v4" });
    expect(service.process({})).toBe("mock-v4-uuid");
  });

  it("action generate calls app.next with processed output", async () => {
    const { service, app } = createService();

    await service.configure({ action: "generate" });

    expect(app.next).toHaveBeenCalledTimes(1);
    expect(app.next).toHaveBeenCalledWith(service, "mock-v4-uuid");
  });

  it("always notifies current method after configure", async () => {
    const { service, app } = createService();

    await service.configure({});

    expect(app.notify).toHaveBeenCalledWith(service, { method: "v4" });
  });
});

describe("UuidGenerator process()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plain mode returns uuid string", () => {
    const { service, app } = createService();

    const result = service.process({ input: true });

    expect(result).toBe("mock-v4-uuid");
    expect(app.notify).toHaveBeenCalledWith(service, { uuid: "mock-v4-uuid" });
  });

  it("merge mode returns merged object with uuid", () => {
    const { service, app } = createService();

    service.state.mode = "merge";
    const input = { a: 1, nested: { ok: true } };
    const result = service.process(input);

    expect(result).toEqual({
      a: 1,
      nested: { ok: true },
      uuid: "mock-v4-uuid",
    });
    expect(app.notify).toHaveBeenCalledWith(service, { uuid: "mock-v4-uuid" });
  });

  it("merge mode overwrites incoming uuid field", () => {
    const { service } = createService();

    service.state.mode = "merge";
    const result = service.process({ uuid: "old-value", x: 9 });

    expect(result).toEqual({ uuid: "mock-v4-uuid", x: 9 });
  });

  it("updates state.uuid on each process call", async () => {
    const { service } = createService();

    service.process({});
    let cfg = await service.getConfiguration();
    expect(cfg.uuid).toBe("mock-v4-uuid");

    await service.configure({ method: "v1" });
    service.process({});
    cfg = await service.getConfiguration();
    expect(cfg.uuid).toBe("mock-v1-uuid");
  });
});

describe("UuidGenerator configuration contract", () => {
  it("getConfiguration includes bypass from ServiceBase", async () => {
    const { service } = createService();
    const cfg = await service.getConfiguration();
    expect(cfg).toHaveProperty("bypass", false);
  });

  it("setBypass toggles and notifies", () => {
    const { service, app } = createService();

    service.setBypass(true);
    expect(service.bypass).toBe(true);
    expect(app.notify).toHaveBeenCalledWith(service, { bypass: true });

    service.setBypass(false);
    expect(service.bypass).toBe(false);
    expect(app.notify).toHaveBeenCalledWith(service, { bypass: false });
  });
});
