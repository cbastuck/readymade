import { describe, expect, it, vi } from "vitest";

import {
  ResourceBinding,
  ResourceDescriptor,
  bindingForRuntime,
  findResourceRefs,
  findResourceUses,
  formatResourceRef,
  parseResourceRef,
  readBoardResources,
  readResourcesPayload,
  referencedResources,
  renameResourceRefs,
  resolveResource,
  resourcesById,
  resourcesOfRuntime,
  uniqueResourceId,
  upsertResource,
} from "../resources";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const llm: ResourceDescriptor = { id: "llm", kind: "ollama", models: ["llama3.2"] };
const db: ResourceDescriptor = {
  id: "db",
  kind: "postgres",
  version: "16",
  extensions: ["pgvector"],
};
const files: ResourceDescriptor = { id: "files", kind: "s3", buckets: ["uploads"] };

describe("resource references", () => {
  it("are whole values", () => {
    expect(parseResourceRef("hkp-resource://llm")).toBe("llm");
    expect(parseResourceRef(formatResourceRef("db.main"))).toBe("db.main");
    expect(parseResourceRef("http://hkp-resource://llm")).toBeNull();
    expect(parseResourceRef("hkp-resource://")).toBeNull();
    expect(parseResourceRef(undefined)).toBeNull();
  });

  it("are found anywhere a string mentions one, nested or inside an expression", () => {
    const state = {
      template: {
        "endpoint=": "params.local ? 'hkp-resource://llm' : 'hkp-resource://db'",
      },
      pipeline: [{ state: { database: "hkp-resource://db" } }],
    };
    expect(findResourceRefs(state)).toEqual(["llm", "db"]);
  });

  it("pick out only the descriptors a set of services references", () => {
    const services = [
      { state: { endpoint: "hkp-resource://llm" } },
      { state: { x: "hkp-resource://gone" } },
    ];
    expect(referencedResources(services, [llm, db, files])).toEqual({ llm });
  });
});

describe("used by", () => {
  it("names each service, its runtime and the field", () => {
    const uses = findResourceUses(
      {
        ui: [
          {
            uuid: "prompt",
            serviceName: "Ollama Prompt",
            state: { endpoint: "hkp-resource://llm" },
          },
        ],
        node: [{ uuid: "sql", state: { database: "app.db" } }],
      },
      "llm",
    );
    expect(uses).toEqual([
      {
        runtimeId: "ui",
        serviceUuid: "prompt",
        serviceName: "Ollama Prompt",
        path: ["endpoint"],
        resourceId: "llm",
      },
    ]);
  });
});

describe("renaming", () => {
  it("rewrites whole values and mentions, and nothing that merely starts the same", () => {
    const state = {
      endpoint: "hkp-resource://llm",
      "endpoint=": "x ? 'hkp-resource://llm' : 'hkp-resource://llm-2'",
    };
    expect(renameResourceRefs(state, "llm", "local-llm")).toEqual({
      endpoint: "hkp-resource://local-llm",
      "endpoint=": "x ? 'hkp-resource://local-llm' : 'hkp-resource://llm-2'",
    });
  });

  it("returns the same value when nothing referenced the resource", () => {
    const state = { endpoint: "hkp-resource://other" };
    expect(renameResourceRefs(state, "llm", "local-llm")).toBe(state);
  });
});

describe("a board's resources", () => {
  it("keeps what can be used and names what cannot", () => {
    const { resources, problems } = readBoardResources([
      llm,
      { id: "bad-kind", kind: "mysql" },
      { id: "bad id!", kind: "ollama" },
      { id: "llm", kind: "ollama" },
    ]);
    expect(resources).toEqual([llm]);
    expect(problems).toHaveLength(3);
  });

  it("keeps the optional parts of a descriptor only where they are well-formed", () => {
    const { resources, problems } = readBoardResources([
      { id: "a", name: { en: "A" }, kind: "ollama", models: ["llama3.2", 7, ""] },
      {
        id: "b",
        name: "Main DB",
        kind: "postgres",
        version: 16,
        extensions: ["pgvector"],
        runtimes: ["node", 7],
      },
      { id: "c", kind: "s3", buckets: ["media"] },
    ]);

    expect(problems).toEqual([]);
    expect(resources).toEqual([
      { id: "a", kind: "ollama", models: ["llama3.2"] },
      {
        id: "b",
        name: "Main DB",
        kind: "postgres",
        version: "16",
        extensions: ["pgvector"],
        runtimes: ["node"],
      },
      { id: "c", kind: "s3", buckets: ["media"] },
    ]);
  });

  it("strips address, credential and image fields from a board descriptor and says so", () => {
    const { resources, problems } = readBoardResources([
      {
        id: "db",
        kind: "postgres",
        version: "16",
        url: "postgres://localhost:5432/app",
        password: "secret",
        image: "someone/evil:latest",
      },
    ]);

    expect(resources).toEqual([{ id: "db", kind: "postgres", version: "16" }]);
    expect(problems).toEqual([
      'resource "db" declares url, password, image, which a board never holds; ignored',
    ]);
  });

  it("are a runtime's own document's: the board's, or its unit's", () => {
    const unitDb: ResourceDescriptor = { id: "db", kind: "postgres", version: "15" };
    const units = [{ name: "shop", source: { resources: [unitDb] } }];

    expect(resourcesOfRuntime({}, [llm], units)).toEqual([llm]);
    expect(resourcesOfRuntime(undefined, [llm], units)).toEqual([llm]);
    expect(resourcesOfRuntime({ unit: "shop" }, [llm], units)).toEqual([unitDb]);
    expect(resourcesOfRuntime({ unit: "other" }, [llm], units)).toEqual([]);
  });

  it("are kept from a runtime they do not name", () => {
    const everywhere = llm;
    const onNode = { ...db, runtimes: ["node"] };
    const nowhere = { ...files, runtimes: [] };
    const resources = [everywhere, onNode, nowhere];

    expect(resourcesOfRuntime({ id: "node" }, resources, undefined)).toEqual([
      everywhere,
      onNode,
    ]);
    expect(resourcesOfRuntime({ id: "ui" }, resources, undefined)).toEqual([everywhere]);
  });

  it("are replaced in place and appended when new", () => {
    const edited: ResourceDescriptor = { ...llm, models: ["mistral"] };
    expect(upsertResource([llm, db], edited)).toEqual([edited, db]);
    expect(upsertResource([llm], db)).toEqual([llm, db]);
    const renamed: ResourceDescriptor = { ...llm, id: "local" };
    expect(upsertResource([llm, db], renamed, "llm")).toEqual([renamed, db]);
  });

  it("are given ids that are free", () => {
    expect(uniqueResourceId([llm], "LLM")).toBe("llm-2");
    expect(uniqueResourceId([], "Main DB")).toBe("main-db");
  });
});

describe("bindings and resolution", () => {
  const ollamaBinding: ResourceBinding = {
    id: "llm",
    kind: "ollama",
    url: "http://127.0.0.1:11434",
  };
  const pgBinding: ResourceBinding = {
    id: "db",
    kind: "postgres",
    url: "postgres://127.0.0.1:5432/app",
    user: "app",
    password: "secret",
    database: "app",
  };

  it("resolves a bound resource and checks its kind", () => {
    expect(resolveResource([ollamaBinding, pgBinding], "hkp-resource://llm", "ollama")).toEqual({
      resource: ollamaBinding,
      problem: "",
    });
    expect(
      resolveResource([ollamaBinding, pgBinding], "hkp-resource://llm", "postgres"),
    ).toEqual({
      resource: null,
      problem: 'resource "llm" is of kind "ollama", not "postgres"',
    });
    expect(resolveResource([ollamaBinding], "hkp-resource://missing")).toEqual({
      resource: null,
      problem: 'resource "missing" is not bound',
    });
    expect(resolveResource([ollamaBinding], "http://localhost:11434")).toEqual({
      resource: null,
      problem: '"http://localhost:11434" is not a resource reference',
    });
  });

  it("marks a loopback binding unreachable for a remote runtime on another machine", () => {
    expect(
      bindingForRuntime(ollamaBinding, { type: "browser" }).unreachable,
    ).toBeUndefined();
    expect(
      bindingForRuntime(ollamaBinding, { type: "rest", url: "http://127.0.0.1:8080" })
        .unreachable,
    ).toBeUndefined();
    expect(
      bindingForRuntime(ollamaBinding, { type: "rest", url: "hkp://remotes/embedded" })
        .unreachable,
    ).toBeUndefined();

    const remote = bindingForRuntime(ollamaBinding, {
      type: "rest",
      url: "https://node.example.com",
    });
    expect(remote.unreachable).toContain("cannot reach");
    expect(resolveResource([remote], "hkp-resource://llm", "ollama")).toEqual({
      resource: null,
      problem: remote.unreachable!,
    });
  });

  it("reads a payload of bindings off the wire", () => {
    expect(
      readResourcesPayload({
        llm: ollamaBinding,
        db: pgBinding,
        removed: null,
        bad: { kind: "unknown" },
      }),
    ).toEqual({
      llm: ollamaBinding,
      db: pgBinding,
      removed: null,
    });
    expect(resourcesById([ollamaBinding])).toEqual({ llm: ollamaBinding });
  });
});
