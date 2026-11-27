import type { ConfigurationProperty, RuntimeName, ServiceContract } from "./types.js";

export type JsonSchema = Record<string, unknown>;

export function canonicalServiceId(serviceId: string): string {
  return serviceId.trim().toLowerCase().replace(/^hookup\.to\/service\//, "");
}

export function parseDefaultValue(raw?: string): unknown {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === "—" ||
    trimmed === "-" ||
    trimmed === "–" ||
    /^none$/i.test(trimmed) ||
    /^undefined$/i.test(trimmed) ||
    /^n\/a$/i.test(trimmed)
  ) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    if (/^true\b/i.test(trimmed)) return true;
    if (/^false\b/i.test(trimmed)) return false;
    const numMatch = /^(-?\d+(?:\.\d+)?)\b/.exec(trimmed);
    if (numMatch) {
      return Number(numMatch[1]);
    }
    const quotedMatch = /^['"]([^'"]*)['"]/.exec(trimmed);
    if (quotedMatch) {
      return quotedMatch[1];
    }
    return undefined;
  }
}

function singleTypeToJsonSchema(raw: string): JsonSchema {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  const literalMatch = /^(?:"([^"]*)"|'([^']*)')$/.exec(trimmed);
  if (literalMatch) {
    return {
      type: "string",
      const: literalMatch[1] ?? literalMatch[2] ?? "",
    };
  }

  const arraySuffix = /^(.+)\[\]$/.exec(trimmed);
  if (arraySuffix) {
    return {
      type: "array",
      items: typeStringToJsonSchema(arraySuffix[1]),
    };
  }

  const genericArray = /^array<(.+)>$/i.exec(trimmed);
  if (genericArray) {
    return {
      type: "array",
      items: typeStringToJsonSchema(genericArray[1]),
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower === "boolean" || lower === "bool") {
    return { type: "boolean" };
  }
  if (lower === "integer" || lower === "int") {
    return { type: "integer" };
  }
  if (lower === "number" || lower === "float" || lower === "double") {
    return { type: "number" };
  }
  if (lower === "string" || lower === "text") {
    return { type: "string" };
  }
  if (
    lower === "object" ||
    lower === "json" ||
    lower === "map" ||
    lower.startsWith("record<") ||
    lower.startsWith("{")
  ) {
    return { type: "object" };
  }
  if (lower === "array" || lower === "list") {
    return { type: "array" };
  }
  if (lower === "null") {
    return { type: "null" };
  }
  if (lower === "any" || lower === "unknown" || lower === "*") {
    return {};
  }

  return {};
}

export function typeStringToJsonSchema(rawType: string): JsonSchema {
  const trimmed = rawType.trim();
  if (!trimmed) {
    return {};
  }

  const parts = trimmed
    .split(/\s*\|\s*|\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return singleTypeToJsonSchema(trimmed);
  }

  const mapped = parts.map(singleTypeToJsonSchema);
  if (
    mapped.every(
      (schema) =>
        schema.type === "string" && typeof schema.const === "string",
    )
  ) {
    return {
      type: "string",
      enum: mapped.map((schema) => schema.const as string),
    };
  }

  const nonEmpty = mapped.filter((schema) => Object.keys(schema).length > 0);
  if (nonEmpty.length === 0) {
    return {};
  }
  if (nonEmpty.length === 1) {
    return nonEmpty[0];
  }
  return { anyOf: nonEmpty };
}

export function configurationPropertyToSchema(
  prop: ConfigurationProperty,
): JsonSchema {
  const schema: JsonSchema = {
    ...typeStringToJsonSchema(prop.type),
  };
  if (prop.description) {
    schema.description = prop.description;
  }
  const defaultValue = parseDefaultValue(prop.defaultValue);
  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }
  return schema;
}

function insertPropertySchema(
  properties: Record<string, JsonSchema>,
  rawPropertyName: string,
  propSchema: JsonSchema,
): void {
  const cleaned = rawPropertyName.trim().replace(/\[\]$/g, "");
  if (!cleaned) {
    return;
  }

  if (!cleaned.includes(".")) {
    properties[cleaned] = propSchema;
    return;
  }

  const segments = cleaned
    .split(".")
    .map((segment) => segment.replace(/\[\]$/g, "").trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor = properties;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const existing = cursor[segment];
    if (
      !existing ||
      typeof existing !== "object" ||
      existing.type !== "object" ||
      !existing.properties
    ) {
      cursor[segment] = {
        type: "object",
        properties: {},
      };
    }
    cursor = cursor[segment].properties as Record<string, JsonSchema>;
  }
  cursor[segments[segments.length - 1]] = propSchema;
}

export interface GroupedServiceContract {
  canonicalId: string;
  name: string;
  summary: string;
  serviceIds: string[];
  runtimes: RuntimeName[];
  configuration: ConfigurationProperty[];
}

export function groupContractsByService(
  contracts: readonly ServiceContract[],
): GroupedServiceContract[] {
  const byCanonical = new Map<string, GroupedServiceContract>();

  for (const contract of contracts) {
    const canonicalId = canonicalServiceId(contract.serviceId);
    let group = byCanonical.get(canonicalId);
    if (!group) {
      group = {
        canonicalId,
        name: contract.name,
        summary: contract.summary,
        serviceIds: [],
        runtimes: [],
        configuration: [],
      };
      byCanonical.set(canonicalId, group);
    }

    for (const id of [contract.serviceId, ...contract.aliases]) {
      if (!group.serviceIds.includes(id)) {
        group.serviceIds.push(id);
      }
    }
    if (!group.runtimes.includes(contract.runtime)) {
      group.runtimes.push(contract.runtime);
    }
    for (const prop of contract.configuration) {
      if (!group.configuration.some((existing) => existing.property === prop.property)) {
        group.configuration.push(prop);
      }
    }
  }

  return [...byCanonical.values()].sort((a, b) =>
    a.canonicalId.localeCompare(b.canonicalId),
  );
}

export function buildServiceStateSchema(
  group: GroupedServiceContract,
): JsonSchema {
  const properties: Record<string, JsonSchema> = {
    bypass: {
      type: "boolean",
      default: false,
      description: "When true, the runtime skips this service and passes input straight through.",
    },
  };

  if (
    group.canonicalId === "sub-service" ||
    group.canonicalId === "browser-sub-service" ||
    group.canonicalId === "nested-pipeline"
  ) {
    properties.stopPropagation = {
      type: "boolean",
      default: false,
      description: "Whether what the nested pipeline produces is stopped from leaving the sub-service.",
    };
    properties.scope = {
      type: "object",
      description: "Scope visibility settings for slots inside this sub-service.",
      properties: {
        slots: {
          type: "string",
          enum: ["own", "inherit"],
          default: "inherit",
        },
      },
    };
    properties.pipeline = {
      type: "array",
      description: "Ordered list of nested services in this sub-service.",
    };
  }

  for (const prop of group.configuration) {
    insertPropertySchema(properties, prop.property, configurationPropertyToSchema(prop));
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://readymadeit.com/schemas/services/${group.canonicalId}.schema.json`,
    title: `${group.name} Service State`,
    description: `${group.summary} (Runtimes: ${group.runtimes.join(", ")}; IDs: ${group.serviceIds.join(", ")})`,
    type: "object",
    properties,
    additionalProperties: true,
  };
}

export function buildAllServiceStateSchemas(
  contracts: readonly ServiceContract[],
): Record<string, JsonSchema> {
  const result: Record<string, JsonSchema> = {};
  for (const group of groupContractsByService(contracts)) {
    result[group.canonicalId] = buildServiceStateSchema(group);
  }
  return result;
}

export function buildCombinedServiceStateSchema(
  contracts: readonly ServiceContract[],
): JsonSchema {
  const groups = groupContractsByService(contracts);
  const properties: Record<string, JsonSchema> = {
    bypass: {
      type: "boolean",
      default: false,
      description: "When true, the runtime skips this service and passes input straight through.",
    },
  };

  for (const group of groups) {
    for (const prop of group.configuration) {
      const schema = configurationPropertyToSchema(prop);
      const tagged: JsonSchema = {
        ...schema,
        description: prop.description
          ? `[${group.name}] ${prop.description}`
          : `[${group.name}] configuration property`,
      };
      insertPropertySchema(properties, prop.property, tagged);
    }
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://readymadeit.com/schemas/service-state.schema.json",
    title: "Readymade Service State",
    description: "Configuration state for a Readymade service instance, generated from indexed service contracts.",
    type: "object",
    properties,
    additionalProperties: true,
  };
}

export function buildBoardSchema(
  contracts: readonly ServiceContract[],
  facadeSchema?: JsonSchema,
): JsonSchema {
  const groups = groupContractsByService(contracts);
  const serviceStates: Record<string, JsonSchema> = {};
  const serviceIdOptions: JsonSchema[] = [];
  const conditionalStateRules: JsonSchema[] = [];

  for (const group of groups) {
    const stateSchema = buildServiceStateSchema(group);
    const { $schema: _s, $id: _id, ...inlineStateSchema } = stateSchema;
    serviceStates[group.canonicalId] = inlineStateSchema;

    for (const serviceId of group.serviceIds) {
      serviceIdOptions.push({
        type: "string",
        const: serviceId,
        description: `${group.name} (${group.runtimes.join(", ")}): ${group.summary}`,
      });
    }

    conditionalStateRules.push({
      if: {
        properties: {
          serviceId: {
            enum: group.serviceIds,
          },
        },
        required: ["serviceId"],
      },
      then: {
        properties: {
          state: {
            $ref: `#/definitions/ServiceStates/${group.canonicalId}`,
          },
        },
      },
    });
  }

  // Allow custom or dynamic service IDs not yet in the static index.
  serviceIdOptions.push({ type: "string" });

  const definitions: Record<string, JsonSchema> = {
    RuntimeDescriptor: {
      type: "object",
      required: ["id", "name", "type"],
      properties: {
        id: {
          type: "string",
          description: "Unique identifier of this runtime on the board, referenced by the services map.",
        },
        name: {
          type: "string",
          description: "Display label for the runtime.",
        },
        type: {
          type: "string",
          enum: ["browser", "rest", "graphql", "realtime", "remote"],
          description: "Runtime execution environment type (`browser`, `rest`, or `graphql`).",
        },
        url: {
          type: "string",
          description: "Direct URL of a remote runtime server (mutually exclusive with `remote`).",
        },
        remote: {
          type: "string",
          examples: ["embedded", "node", "python"],
          description: "Logical name of a remote runtime server resolved by the host client (mutually exclusive with `url`).",
        },
        color: {
          type: "string",
          description: "Display accent colour for this runtime.",
        },
        bundles: {
          type: "array",
          items: { type: "string" },
          description: "Optional plugin libraries loaded by the runtime.",
        },
        state: {
          type: "object",
          description: "Per-runtime presentation and logging settings.",
          properties: {
            minimized: { type: "boolean" },
            wrapServices: { type: "boolean" },
            logging: { type: "boolean" },
            logLevel: { type: "string" },
            logData: { type: "boolean" },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: true,
    },
    ServiceDescriptor: {
      type: "object",
      required: ["uuid", "serviceId"],
      properties: {
        uuid: {
          type: "string",
          description: "Unique identifier of this service instance within its runtime.",
        },
        serviceId: {
          anyOf: serviceIdOptions,
          description: "Identifier the runtime registry resolves to instantiate the service.",
        },
        serviceName: {
          type: "string",
          description: "Human-readable display name for this service instance.",
        },
        state: {
          type: "object",
          description: "Service configuration and reported state.",
          additionalProperties: true,
        },
      },
      allOf: conditionalStateRules,
      additionalProperties: true,
    },
    BlockUseDescriptor: {
      type: "object",
      required: ["block"],
      properties: {
        block: {
          type: "string",
          description: "Name of a block defined in the board's `blocks` dictionary.",
        },
        instanceId: {
          type: "string",
          description: "Instance identifier for this block use.",
        },
        uuid: {
          type: "string",
          description: "Instance identifier for this block use.",
        },
        serviceName: {
          type: "string",
          description: "Display label for this block use.",
        },
        params: {
          type: "object",
          description: "Parameter overrides applied to the block definition.",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
    PipelineEntry: {
      anyOf: [
        { $ref: "#/definitions/ServiceDescriptor" },
        { $ref: "#/definitions/BlockUseDescriptor" },
      ],
    },
    AssetDescriptor: {
      type: "object",
      required: ["id"],
      properties: {
        id: {
          type: "string",
          description: "Asset identifier referenced from service state as `hkp-asset://<id>`.",
        },
        name: { type: "string" },
        contentType: { type: "string" },
        inline: { type: "string" },
        base64: { type: "string" },
        url: { type: "string" },
      },
      additionalProperties: true,
    },
    ServiceStates: serviceStates,
  };

  let facadeProperty: JsonSchema = {
    type: "object",
    description: "App-like interface of controls and displays over the board.",
    additionalProperties: true,
  };

  if (
    facadeSchema &&
    typeof facadeSchema.definitions === "object" &&
    facadeSchema.definitions !== null
  ) {
    Object.assign(
      definitions,
      facadeSchema.definitions as Record<string, JsonSchema>,
    );
    if (definitions.FacadeDescriptor) {
      facadeProperty = {
        $ref: "#/definitions/FacadeDescriptor",
        description: "App-like interface of controls and displays over the board.",
      };
    }
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://readymadeit.com/schemas/board.schema.json",
    title: "Readymade Board",
    description: "A Readymade board document: ordered runtimes, ordered service pipelines, and optional facade, assets, blocks and units.",
    type: "object",
    required: ["runtimes", "services"],
    properties: {
      boardName: {
        type: "string",
        description: "Display name of the board.",
      },
      description: {
        type: "string",
        description: "A short description of what the board does.",
      },
      runtimes: {
        type: "array",
        description: "Ordered array of execution environments. Order is the chain.",
        items: { $ref: "#/definitions/RuntimeDescriptor" },
      },
      services: {
        type: "object",
        description: "Map from runtime id to that runtime's ordered service pipeline.",
        additionalProperties: {
          type: "array",
          items: { $ref: "#/definitions/PipelineEntry" },
        },
      },
      facade: facadeProperty,
      assets: {
        type: "array",
        description: "Content declared once in the board and referenced from service state as `hkp-asset://<id>`.",
        items: { $ref: "#/definitions/AssetDescriptor" },
      },
      blocks: {
        type: "object",
        description: "Reusable service definitions referenced in pipelines by `{ \"block\": \"<id>\" }`.",
        additionalProperties: { type: "object" },
      },
      unit: {
        type: "object",
        description: "What this board imports and exports when used as a unit.",
        additionalProperties: true,
      },
      units: {
        type: "array",
        description: "Units this composition board is assembled from.",
        items: { type: "object" },
      },
      registry: {
        type: "object",
        description: "Cached service registry metadata reported by runtimes.",
        additionalProperties: true,
      },
    },
    definitions,
    additionalProperties: true,
  };
}
