import * as z from "zod/v4";
import { runtimeNames } from "./types.js";

export const runtimeSchema = z.enum(runtimeNames);

export const searchKnowledgeInput = z.object({
  query: z.string().min(2).max(500),
  runtime: runtimeSchema.optional(),
  kind: z.enum(["documentation", "board", "service"]).optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export const getServiceContractInput = z.object({
  serviceId: z.string().min(1).max(200),
  runtime: runtimeSchema,
  version: z.string().min(1).max(100).optional(),
});

export const findCompatibleServicesInput = z.object({
  inputType: z.string().min(1).max(100),
  outputType: z.string().min(1).max(100),
  runtime: runtimeSchema.optional(),
});

export const findBoardExamplesInput = z.object({
  serviceIds: z.array(z.string().min(1).max(200)).min(1).max(30),
  runtime: runtimeSchema.optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export const readDocumentInput = z.object({
  paths: z.array(z.string().min(1).max(500)).min(1).max(8),
});

export const inspectServiceSourceInput = z.object({
  serviceId: z.string().min(1).max(200),
  runtime: runtimeSchema,
  version: z.string().min(1).max(100).optional(),
  maxLines: z.number().int().min(20).max(400).default(180),
});

export const validateBoardInput = z.object({ board: z.unknown() });

export const readymadeToolSchemas = {
  search_knowledge: searchKnowledgeInput,
  get_service_contract: getServiceContractInput,
  find_compatible_services: findCompatibleServicesInput,
  find_board_examples: findBoardExamplesInput,
  read_document: readDocumentInput,
  inspect_service_source: inspectServiceSourceInput,
  validate_board: validateBoardInput,
} as const;
