import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgeRepository } from "../../readymade-mcp/src/repository.js";
import {
  buildAllServiceStateSchemas,
  buildBoardSchema,
  buildCombinedServiceStateSchema,
  type JsonSchema,
} from "../src/schemas.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(extensionRoot, "..");

export async function generateSchemas(outDir = path.join(extensionRoot, "schemas")): Promise<{
  boardSchemaPath: string;
  serviceStateSchemaPath: string;
  serviceCount: number;
}> {
  const repo = await KnowledgeRepository.create(repoRoot);
  const contracts = repo.listContracts();

  let facadeSchema: JsonSchema | undefined;
  try {
    const rawFacade = readFileSync(
      path.join(repoRoot, "hkp-frontend/src/facade/facade.schema.json"),
      "utf8",
    );
    facadeSchema = JSON.parse(rawFacade) as JsonSchema;
  } catch {
    facadeSchema = undefined;
  }

  const boardSchema = buildBoardSchema(contracts, facadeSchema);
  const combinedStateSchema = buildCombinedServiceStateSchema(contracts);
  const perServiceSchemas = buildAllServiceStateSchemas(contracts);

  const servicesDir = path.join(outDir, "services");
  mkdirSync(servicesDir, { recursive: true });

  const boardSchemaPath = path.join(outDir, "board.schema.json");
  const serviceStateSchemaPath = path.join(outDir, "service-state.schema.json");

  writeFileSync(boardSchemaPath, `${JSON.stringify(boardSchema, null, 2)}\n`);
  writeFileSync(
    serviceStateSchemaPath,
    `${JSON.stringify(combinedStateSchema, null, 2)}\n`,
  );

  for (const [canonicalId, schema] of Object.entries(perServiceSchemas)) {
    const safeName = canonicalId.replace(/[^a-z0-9_.-]/gi, "_");
    writeFileSync(
      path.join(servicesDir, `${safeName}.schema.json`),
      `${JSON.stringify(schema, null, 2)}\n`,
    );
  }

  return {
    boardSchemaPath,
    serviceStateSchemaPath,
    serviceCount: Object.keys(perServiceSchemas).length,
  };
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  generateSchemas().then(({ boardSchemaPath, serviceCount }) => {
    console.log(
      `Generated ${boardSchemaPath} and ${serviceCount} service state schemas.`,
    );
  });
}
