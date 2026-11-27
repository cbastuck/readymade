import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { KnowledgeRepository } from "../../readymade-mcp/src/repository.js";
import { generateSchemas } from "../scripts/generate-schemas.js";
import {
  buildAllServiceStateSchemas,
  buildBoardSchema,
  type JsonSchema,
} from "../src/schemas.js";

const extensionRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(extensionRoot, "..");

let repo: KnowledgeRepository;

beforeAll(async () => {
  repo = await KnowledgeRepository.create(repoRoot, "test-build");
  await generateSchemas(path.join(extensionRoot, "schemas"));
});

describe("JSON Schema generation from readymade-mcp contracts", () => {
  it("generates per-service state schemas with typed properties, defaults, and descriptions", () => {
    const schemas = buildAllServiceStateSchemas(repo.listContracts());

    expect(Object.keys(schemas).length).toBeGreaterThan(40);

    const timerSchema = schemas.timer;
    expect(timerSchema).toBeDefined();
    const timerProps = timerSchema.properties as Record<string, JsonSchema>;
    expect(timerProps.periodic).toMatchObject({
      type: "boolean",
      default: false,
    });
    expect(timerProps.periodicValue).toMatchObject({
      type: "number",
      default: 1,
    });
    expect(timerProps.periodicUnit).toMatchObject({
      type: "string",
      default: "s",
    });
    // Nested dotted property `until.triggerCount`
    expect(timerProps.until).toMatchObject({
      type: "object",
      properties: {
        triggerCount: {
          type: "number",
        },
      },
    });

    const filterSchema = schemas.filter;
    expect(filterSchema).toBeDefined();
    const filterProps = filterSchema.properties as Record<string, JsonSchema>;
    expect(filterProps.aggregator).toMatchObject({
      type: "string",
      enum: ["and", "or"],
      default: "and",
    });
    expect(filterProps.conditions).toMatchObject({
      anyOf: [
        { type: "string" },
        { type: "array", items: { type: "string" } },
      ],
      default: [],
    });
  });

  it("generates a board schema with conditional service state schemas and facade definitions", () => {
    const facadeSchema = JSON.parse(
      readFileSync(
        path.join(repoRoot, "hkp-frontend/src/facade/facade.schema.json"),
        "utf8",
      ),
    ) as JsonSchema;
    const boardSchema = buildBoardSchema(repo.listContracts(), facadeSchema);

    expect(boardSchema.required).toEqual(["runtimes", "services"]);
    const definitions = boardSchema.definitions as Record<string, JsonSchema>;
    expect(definitions.RuntimeDescriptor).toBeDefined();
    expect(definitions.ServiceDescriptor).toBeDefined();
    expect(definitions.FacadeDescriptor).toBeDefined();

    const serviceStates = definitions.ServiceStates as Record<string, JsonSchema>;
    expect(serviceStates.timer).toBeDefined();
    expect(serviceStates.filter).toBeDefined();

    const allOf = definitions.ServiceDescriptor.allOf as Array<{
      if: { properties: { serviceId: { enum: string[] } } };
      then: { properties: { state: { $ref: string } } };
    }>;
    const timerRule = allOf.find((rule) =>
      rule.if.properties.serviceId.enum.includes("hookup.to/service/timer"),
    );
    expect(timerRule).toBeDefined();
    expect(timerRule?.if.properties.serviceId.enum).toContain("timer");
    expect(timerRule?.then.properties.state.$ref).toBe(
      "#/definitions/ServiceStates/timer",
    );
  });

  it("writes schemas/board.schema.json, schemas/service-state.schema.json, and per-service schemas", () => {
    const boardSchemaPath = path.join(extensionRoot, "schemas/board.schema.json");
    const stateSchemaPath = path.join(
      extensionRoot,
      "schemas/service-state.schema.json",
    );
    const timerSchemaPath = path.join(
      extensionRoot,
      "schemas/services/timer.schema.json",
    );

    expect(existsSync(boardSchemaPath)).toBe(true);
    expect(existsSync(stateSchemaPath)).toBe(true);
    expect(existsSync(timerSchemaPath)).toBe(true);

    const parsedBoardSchema = JSON.parse(readFileSync(boardSchemaPath, "utf8"));
    expect(parsedBoardSchema.title).toBe("Readymade Board");
  });
});
