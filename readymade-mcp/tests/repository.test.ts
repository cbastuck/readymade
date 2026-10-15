import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { KnowledgeRepository } from "../src/repository.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
let repository: KnowledgeRepository;

beforeAll(async () => {
  repository = await KnowledgeRepository.create(repositoryRoot, "test-build");
});

describe("KnowledgeRepository", () => {
  it("builds a versioned local index", () => {
    const stats = repository.stats();
    expect(stats.documents).toBeGreaterThan(100);
    expect(stats.boards).toBeGreaterThan(100);
    expect(stats.contracts).toBeGreaterThan(50);
    expect(stats.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(stats.buildVersion).toBe("test-build");
  });

  it("extracts runtime-specific contracts and markdown tables", () => {
    const contract = repository.getServiceContract("timer", "node", "test-build");
    expect(contract.name).toBe("Timer");
    expect(contract.configuration).toContainEqual(expect.objectContaining({ property: "oneShotDelay", type: "number" }));
    expect(contract.sourceReferences.map((item) => item.path)).toContain("hkp-node/src/services/timer.ts");
    expect(contract.sourceReferences[0].commit).toMatch(/^[a-f0-9]{40}$/);
    expect(contract.sourceReferences[0].contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(contract.warning).toBeUndefined();
  });

  it("labels build mismatches instead of silently claiming a match", () => {
    const contract = repository.getServiceContract("timer", "node", "other-build");
    expect(contract.documentation.exactBuildMatch).toBe(false);
    expect(contract.warning).toContain("other-build");
  });

  it("searches and reads only indexed documents", () => {
    const result = repository.search("filter conditions", { runtime: "browser", kind: "service" });
    expect(result[0].provenance.path).toBe("docs/content/services/filter.md");
    expect(repository.readDocuments([result[0].provenance.path])[0].content).toContain("# Filter");
    expect(() => repository.readDocuments(["../../etc/passwd"])).toThrow("not an indexed document");
    expect(() => repository.readDocuments(["hkp-node/src/services/timer.ts"])).toThrow("not an indexed document");
  });

  it("finds examples and returns bounded allowlisted source", () => {
    const examples = repository.findBoardExamples(["hookup.to/service/filter"]);
    expect(examples.some((item) => item.provenance.path === "boards/filter-demo-board.json")).toBe(true);
    const sources = repository.inspectServiceSource("timer", "python", undefined, 20);
    expect(sources[0].provenance.path).toBe("hkp-python/src/hkp/services/timer.py");
    expect(sources[0].lineEnd - sources[0].lineStart + 1).toBeLessThanOrEqual(20);
  });

  it("returns actionable static board diagnostics", () => {
    const validation = repository.validateBoard({
      boardName: "Broken",
      runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
      services: {
        ui: [{ uuid: "one", serviceId: "missing-service", state: [] }],
        orphan: [],
      },
    });
    expect(validation.valid).toBe(false);
    expect(validation.mode).toBe("static");
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "service.state", severity: "error" }),
      expect.objectContaining({ code: "service.unknown", severity: "warning" }),
      expect.objectContaining({ code: "pipeline.orphan", severity: "error" }),
    ]));
  });
});
