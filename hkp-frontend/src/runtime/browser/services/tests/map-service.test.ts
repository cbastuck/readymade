/**
 * Map service tests
 *
 * Covers:
 *  - All three modes (replace / add / overwrite) and their interactions
 *  - Mode switching between operations
 *  - Static-property templates, expression-term templates, nested-path templates, scalar templates
 *  - Various input shapes: plain objects, nested objects, arrays, primitives, null / undefined
 *  - sensingMode: learns template from first processed input
 *  - Command injection via configure({ command: { action: "inject", params } })
 *  - Error recovery (returns input on expression failure)
 *  - getConfiguration() contracts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import MapDescriptor from "../base/Map";

// The descriptor exports { serviceName, serviceId, service, Map } where Map is the class.
const MapService = MapDescriptor.Map;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    processRuntimeByName: vi.fn(),
  };
}

function createMapService() {
  const app = createMockApp();
  const service = new MapService(app as any, "test-board", {} as any, "map-1");
  return { service, app };
}

// ---------------------------------------------------------------------------
// Descriptor shape
// ---------------------------------------------------------------------------

describe("Map descriptor", () => {
  it("exports serviceName and serviceId", () => {
    expect(MapDescriptor.serviceName).toBe("Map");
    expect(MapDescriptor.serviceId).toBe("hookup.to/service/map");
  });

  it("exports a constructable Map class", () => {
    const { service } = createMapService();
    expect(service).toBeDefined();
    expect(typeof service.configure).toBe("function");
    expect(typeof service.process).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe("Map service – default state", () => {
  it("starts in replace mode", async () => {
    const { service } = createMapService();
    const cfg = await service.getConfiguration();
    expect(cfg.mode).toBe("replace");
  });

  it("starts with an empty template", async () => {
    const { service } = createMapService();
    const cfg = await service.getConfiguration();
    expect(cfg.template).toEqual({});
  });

  it("starts with sensingMode off", async () => {
    const { service } = createMapService();
    const cfg = await service.getConfiguration();
    expect(cfg.sensingMode).toBe(false);
  });

  it("process() with empty template (replace) returns empty object", async () => {
    const { service } = createMapService();
    const result = await service.process({ a: 1, b: 2 });
    expect(result).toEqual({});
  });

  it("process() with empty template (add) returns the input unchanged", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "add" });
    const input = { a: 1, b: 2 };
    const result = await service.process(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("process() with empty template (overwrite) returns the input unchanged", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "overwrite" });
    const input = { x: 10 };
    const result = await service.process(input);
    expect(result).toEqual({ x: 10 });
  });
});

// ---------------------------------------------------------------------------
// configure() – mode switching
// ---------------------------------------------------------------------------

describe("Map service – configure() mode", () => {
  it("switches to add mode and notifies", async () => {
    const { service, app } = createMapService();
    await service.configure({ mode: "add" });
    const cfg = await service.getConfiguration();
    expect(cfg.mode).toBe("add");
    expect(app.notify).toHaveBeenCalledWith(service, { mode: "add" });
  });

  it("switches to overwrite mode and notifies", async () => {
    const { service, app } = createMapService();
    await service.configure({ mode: "overwrite" });
    const cfg = await service.getConfiguration();
    expect(cfg.mode).toBe("overwrite");
    expect(app.notify).toHaveBeenCalledWith(service, { mode: "overwrite" });
  });

  it("switches mode multiple times", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "add" });
    await service.configure({ mode: "overwrite" });
    await service.configure({ mode: "replace" });
    const cfg = await service.getConfiguration();
    expect(cfg.mode).toBe("replace");
  });

  it("does not notify when mode is not part of a configure call", async () => {
    const { service, app } = createMapService();
    await service.configure({ template: { x: 1 } });
    expect(app.notify).not.toHaveBeenCalledWith(
      service,
      expect.objectContaining({ mode: expect.anything() }),
    );
  });
});

// ---------------------------------------------------------------------------
// configure() – template
// ---------------------------------------------------------------------------

describe("Map service – configure() template", () => {
  it("sets a static property and notifies", async () => {
    const { service, app } = createMapService();
    await service.configure({ template: { greeting: "hello" } });
    expect(app.notify).toHaveBeenCalledWith(service, {
      template: { greeting: "hello" },
    });
  });

  it("overwrites template on a second configure call", async () => {
    const { service } = createMapService();
    await service.configure({ template: { a: 1 } });
    await service.configure({ template: { b: 2 } });
    const cfg = await service.getConfiguration();
    // flat state.template should reflect the latest template
    expect(cfg.template).not.toHaveProperty("a");
    expect(cfg.template).toHaveProperty("b", 2);
  });
});

// ---------------------------------------------------------------------------
// configure() – sensingMode
// ---------------------------------------------------------------------------

describe("Map service – configure() sensingMode", () => {
  it("enables sensingMode and notifies", async () => {
    const { service, app } = createMapService();
    await service.configure({ sensingMode: true });
    const cfg = await service.getConfiguration();
    expect(cfg.sensingMode).toBe(true);
    expect(app.notify).toHaveBeenCalledWith(service, { sensingMode: true });
  });

  it("disables sensingMode", async () => {
    const { service } = createMapService();
    await service.configure({ sensingMode: true });
    await service.configure({ sensingMode: false });
    const cfg = await service.getConfiguration();
    expect(cfg.sensingMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// configure() – command injection
// ---------------------------------------------------------------------------

describe("Map service – configure() command injection", () => {
  it("inject command calls app.next with processed result of a static template", async () => {
    const { service, app } = createMapService();
    await service.configure({ template: { label: "fixed" } });
    await service.configure({
      command: { action: "inject", params: { id: 99 } },
    });
    expect(app.next).toHaveBeenCalledWith(service, { label: "fixed" });
  });

  it("inject command evaluates expression template against injected params", async () => {
    const { service, app } = createMapService();
    await service.configure({ template: { "tripled=": "params.n * 3" } });
    await service.configure({
      command: { action: "inject", params: { n: 4 } },
    });
    expect(app.next).toHaveBeenCalledWith(service, { tripled: 12 });
  });
});

// ---------------------------------------------------------------------------
// replace mode – process() behaviour
// ---------------------------------------------------------------------------

describe("Map service – replace mode", () => {
  it("static template: output contains only template keys, input keys are dropped", async () => {
    const { service } = createMapService();
    await service.configure({ template: { brand: "hookup" } });
    const result = await service.process({
      id: 42,
      name: "Alice",
      extra: "dropped",
    });
    expect(result).toEqual({ brand: "hookup" });
  });

  it("expression term: result is computed from input", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "doubled=": "params.value * 2" } });
    const result = await service.process({ value: 7 });
    expect(result).toEqual({ doubled: 14 });
  });

  it("mixed static and expression: both appear in output", async () => {
    const { service } = createMapService();
    await service.configure({
      template: { type: "report", "label=": "params.name" },
    });
    const result = await service.process({ name: "Alice" });
    expect(result).toEqual({ type: "report", label: "Alice" });
  });

  it("nested path static: creates nested object in output", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "meta.author": "system" } });
    const result = (await service.process({ ignored: true })) as any;
    expect(result.meta.author).toBe("system");
    expect(result).not.toHaveProperty("ignored");
  });

  it("nested path expression: writes computed value at nested key", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "user.name=": "params.firstName" } });
    const result = (await service.process({ firstName: "Bob" })) as any;
    expect(result.user.name).toBe("Bob");
  });

  it("scalar expression (empty key): maps entire input to a primitive", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "=": "params.a + params.b" } });
    const result = await service.process({ a: 3, b: 7 });
    expect(result).toBe(10);
  });

  it("scalar string concatenation expression", async () => {
    const { service } = createMapService();
    await service.configure({
      template: { "=": "params.first + ' ' + params.last" },
    });
    const result = await service.process({ first: "Jane", last: "Doe" });
    expect(result).toBe("Jane Doe");
  });

  it("array input: applies mapper to each element independently", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "out=": "params.n * 2" } });
    const result = await service.process([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(result).toEqual([{ out: 2 }, { out: 4 }, { out: 6 }]);
  });

  it("empty array input: returns empty array", async () => {
    const { service } = createMapService();
    await service.configure({ template: { label: "x" } });
    const result = await service.process([]);
    expect(result).toEqual([]);
  });

  it("multi-field expressions referencing different input keys", async () => {
    const { service } = createMapService();
    await service.configure({
      template: {
        "fullName=": "params.first + ' ' + params.last",
        "age=": "params.age",
      },
    });
    const result = await service.process({
      first: "Jane",
      last: "Doe",
      age: 30,
    });
    expect(result).toEqual({ fullName: "Jane Doe", age: 30 });
  });

  it("numeric input field referenced in expression", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "square=": "params.x * params.x" } });
    const result = await service.process({ x: 9 });
    expect(result).toEqual({ square: 81 });
  });

  it("boolean fields pass through expressions", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "flag=": "params.active" } });
    const result = await service.process({ active: false });
    expect(result).toEqual({ flag: false });
  });

  it("deeply nested JSON object input: expression can reach nested values", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "city=": "params.address.city" } });
    const result = await service.process({
      address: { city: "Berlin", zip: "10115" },
    });
    expect(result).toEqual({ city: "Berlin" });
  });
});

// ---------------------------------------------------------------------------
// add mode – process() behaviour
// ---------------------------------------------------------------------------

describe("Map service – add mode", () => {
  beforeEach(() => {
    // each test calls configure({ mode: "add" }) to keep them self-contained
  });

  it("preserves existing input key when expression would overwrite it", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "add",
      template: { "x=": "params.x + 1" },
    });
    const result = (await service.process({ x: 10 })) as any;
    // x exists in input – add mode preserves original value
    expect(result.x).toBe(10);
  });

  it("writes expression result when input key is absent", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "add",
      template: { "extra=": "params.base * 2" },
    });
    const result = (await service.process({ base: 5 })) as any;
    // 'extra' not in input – expression applied
    expect(result.extra).toBe(10);
  });

  it("adds static template property to output alongside input", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "add", template: { source: "pipeline" } });
    const result = await service.process({ id: 1, name: "data" });
    expect(result).toEqual({ source: "pipeline", id: 1, name: "data" });
  });

  it("does not add static template property if input already has the key", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "add", template: { status: "default" } });
    const result = (await service.process({ status: "custom" })) as any;
    // static property is part of initial merge: { ...properties, ...input }
    // so input wins for static duplicate keys too
    expect(result.status).toBe("custom");
  });

  it("array input: add mode applied element-by-element", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "add", template: { tag: "item" } });
    const result = await service.process([{ id: 1 }, { id: 2 }]);
    expect(result).toEqual([
      { tag: "item", id: 1 },
      { tag: "item", id: 2 },
    ]);
  });

  it("all input fields are included in output", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "add", template: { extra: "added" } });
    const result = await service.process({ a: 1, b: 2, c: 3 });
    expect(result).toMatchObject({ a: 1, b: 2, c: 3, extra: "added" });
  });
});

// ---------------------------------------------------------------------------
// overwrite mode – process() behaviour
// ---------------------------------------------------------------------------

describe("Map service – overwrite mode", () => {
  it("all input fields pass through to output", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "overwrite",
      template: { status: "active" },
    });
    const result = await service.process({
      id: 1,
      name: "Bob",
      status: "inactive",
    });
    expect(result).toMatchObject({ id: 1, name: "Bob" });
  });

  it("template static property overwrites input value for same key", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "overwrite",
      template: { status: "active" },
    });
    const result = (await service.process({
      status: "inactive",
      id: 2,
    })) as any;
    expect(result.status).toBe("active");
    expect(result.id).toBe(2);
  });

  it("expression term overwrites input value for same key", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "overwrite",
      template: { "label=": "params.name + '!'" },
    });
    const result = (await service.process({
      label: "old",
      name: "Alice",
    })) as any;
    // expression result always wins in overwrite mode
    expect(result.label).toBe("Alice!");
  });

  it("array input: overwrite mode applied element-by-element", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "overwrite", template: { fixed: true } });
    const result = await service.process([{ x: 1 }, { x: 2 }]);
    expect(result).toEqual([
      { x: 1, fixed: true },
      { x: 2, fixed: true },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Mode switching mid-stream
// ---------------------------------------------------------------------------

describe("Map service – mode switching between operations", () => {
  it("replace → overwrite changes which input fields survive", async () => {
    const { service } = createMapService();
    await service.configure({ template: { status: "mapped" } });

    const r1 = await service.process({ id: 1, extra: "dropped" });
    expect(r1).toEqual({ status: "mapped" });

    await service.configure({ mode: "overwrite" });
    const r2 = await service.process({ id: 1, extra: "kept" });
    expect(r2).toEqual({ id: 1, extra: "kept", status: "mapped" });
  });

  it("overwrite → add changes how expression conflicts are resolved", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "overwrite",
      template: { "v=": "params.v * 10" },
    });

    const r1 = (await service.process({ v: 3 })) as any;
    // overwrite: expression replaces input key
    expect(r1.v).toBe(30);

    await service.configure({ mode: "add" });
    const r2 = (await service.process({ v: 3 })) as any;
    // add: original input key is preserved
    expect(r2.v).toBe(3);
  });

  it("replace → add changes whether unrelated input fields are retained", async () => {
    const { service } = createMapService();
    await service.configure({ template: { tag: "x" } });

    const r1 = (await service.process({ tag: "old", keep: "me" })) as any;
    expect(r1).toEqual({ tag: "x" }); // keep is dropped in replace

    await service.configure({ mode: "add" });
    const r2 = (await service.process({ tag: "old", keep: "me" })) as any;
    expect(r2).toMatchObject({ keep: "me" }); // keep survives in add
  });

  it("template can be replaced while mode is retained", async () => {
    const { service } = createMapService();
    await service.configure({ mode: "overwrite", template: { a: 1 } });
    await service.configure({ template: { b: 2 } });

    const cfg = await service.getConfiguration();
    expect(cfg.mode).toBe("overwrite");

    const result = (await service.process({ x: 9 })) as any;
    expect(result.b).toBe(2);
    expect(result.x).toBe(9); // overwrite keeps input
    expect(result).not.toHaveProperty("a"); // old template gone
  });
});

// ---------------------------------------------------------------------------
// sensingMode
// ---------------------------------------------------------------------------

describe("Map service – sensingMode", () => {
  it("process() returns null when sensingMode is active", async () => {
    const { service } = createMapService();
    await service.configure({ sensingMode: true });
    const result = await service.process({ x: 1, y: 2 });
    expect(result).toBeNull();
  });

  it("sensingMode turns off automatically after first process() call", async () => {
    const { service } = createMapService();
    await service.configure({ sensingMode: true });
    await service.process({ field: "value" });
    const cfg = await service.getConfiguration();
    expect(cfg.sensingMode).toBe(false);
  });

  it("template is updated from processed input after sensed", async () => {
    const { service, app } = createMapService();
    await service.configure({ sensingMode: true });
    await service.process({ color: "red", size: 10 });
    // Template notification should have been fired with the flattened input
    expect(app.notify).toHaveBeenCalledWith(
      service,
      expect.objectContaining({
        template: expect.objectContaining({ color: "red", size: 10 }),
      }),
    );
  });

  it("subsequent process() after sensing uses newly learned template (replace mode)", async () => {
    const { service } = createMapService();
    await service.configure({ sensingMode: true });
    await service.process({ name: "Alice", age: 30 });
    // Now template = { name: "Alice", age: 30 }; mode = replace
    // Processing new input should map through the sensed static template
    const result = await service.process({ name: "Bob", age: 25 });
    // The sensed template had static values "Alice" / 30, not expressions,
    // so replace mode returns those fixed values regardless of new input
    expect(result).toEqual({ name: "Alice", age: 30 });
  });
});

// ---------------------------------------------------------------------------
// Error recovery
// ---------------------------------------------------------------------------

describe("Map service – error recovery", () => {
  it("returns input unchanged when expression evaluates with a syntax error", async () => {
    const { service } = createMapService();
    // Invalid expression string → parseExpression returns "syntax-error"
    await service.configure({ template: { "bad=": "!!!(invalid syntax[[" } });
    const input = { x: 1 };
    const result = await service.process(input);
    expect(result).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// Various data shapes
// ---------------------------------------------------------------------------

describe("Map service – various input data shapes", () => {
  it("input with array-valued fields: expression can reference the array", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "count=": "params.items.length" } });
    const result = await service.process({ items: [1, 2, 3] });
    expect(result).toEqual({ count: 3 });
  });

  it("input with deeply nested objects", async () => {
    const { service } = createMapService();
    await service.configure({
      template: { "code=": "params.address.country.code" },
    });
    const result = await service.process({
      address: { country: { code: "DE", name: "Germany" } },
    });
    expect(result).toEqual({ code: "DE" });
  });

  it("array of objects: each element mapped independently with same template", async () => {
    const { service } = createMapService();
    await service.configure({
      template: {
        "id=": "params.id",
        "label=": "params.name",
        source: "dataset",
      },
    });
    const result = await service.process([
      { id: 1, name: "Alpha" },
      { id: 2, name: "Beta" },
      { id: 3, name: "Gamma" },
    ]);
    expect(result).toEqual([
      { id: 1, label: "Alpha", source: "dataset" },
      { id: 2, label: "Beta", source: "dataset" },
      { id: 3, label: "Gamma", source: "dataset" },
    ]);
  });

  it("mixed-type array: each element mapped through the template", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "val=": "params.v" } });
    const result = await service.process([{ v: 1 }, { v: "two" }, { v: true }]);
    expect(result).toEqual([{ val: 1 }, { val: "two" }, { val: true }]);
  });

  it("input with numeric string keys: expression resolves them", async () => {
    const { service } = createMapService();
    await service.configure({
      template: { "result=": "params['0'] + params['1']" },
    });
    const result = await service.process({ "0": 10, "1": 20 });
    expect(result).toEqual({ result: 30 });
  });

  it("overwrite mode merges extra input fields for various data types", async () => {
    const { service } = createMapService();
    await service.configure({
      mode: "overwrite",
      template: { type: "enriched" },
    });
    const result = await service.process({
      id: 1,
      tags: ["a", "b"],
      meta: { ts: 1234 },
      active: true,
      score: 9.5,
    });
    expect(result).toMatchObject({
      id: 1,
      tags: ["a", "b"],
      meta: { ts: 1234 },
      active: true,
      score: 9.5,
      type: "enriched",
    });
  });

  it("expression using built-in globalScope functions (round)", async () => {
    const { service } = createMapService();
    await service.configure({
      template: { "rounded=": "round(params.value)" },
    });
    const result = await service.process({ value: 3.7 });
    expect(result).toEqual({ rounded: 4 });
  });

  it("expression using string() conversion", async () => {
    const { service } = createMapService();
    await service.configure({
      template: { "asString=": "string(params.num)" },
    });
    const result = await service.process({ num: 42 });
    expect(result).toEqual({ asString: "42" });
  });

  it("expression using number() conversion", async () => {
    const { service } = createMapService();
    await service.configure({ template: { "asNum=": "number(params.val)" } });
    const result = await service.process({ val: "99" });
    expect(result).toEqual({ asNum: 99 });
  });
});
