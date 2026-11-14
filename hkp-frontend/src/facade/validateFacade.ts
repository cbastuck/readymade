import schema from "./facade.schema.json";

/**
 * Checks a facade against its schema — `facade.schema.json`, generated from
 * `types.ts` (`npm run facade-schema`), so the type definitions stay the one
 * place a widget's shape is written down.
 *
 * What it says is meant for whoever wrote the facade, a person or a model:
 * where the value is, which widget it belongs to, and what was expected. A
 * union is resolved by its `type` field where it has one, so a data-table
 * with a wrong column is told about the column rather than that it is none of
 * twenty widgets.
 *
 * It reads the schema rather than compiling it, because the hosts this runs
 * in do not all allow generated code.
 */

type Schema = {
  $ref?: string;
  anyOf?: Schema[];
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
};

const definitions = (schema as unknown as { definitions: Record<string, Schema> })
  .definitions;

/** Reported problems per facade; enough to fix, not a wall of them. */
const MAX_PROBLEMS = 8;

function resolve(node: Schema): Schema {
  let current = node;
  for (let hops = 0; current.$ref && hops < 32; hops++) {
    const name = current.$ref.replace("#/definitions/", "");
    const next = definitions[decodeURIComponent(name)];
    if (!next) throw new Error(`Facade schema has no definition ${name}`);
    current = next;
  }
  return current;
}

/** The branches of a union, nested unions and references unfolded. */
function branches(node: Schema, into: Schema[] = []): Schema[] {
  const resolved = resolve(node);
  if (resolved.anyOf) resolved.anyOf.forEach((branch) => branches(branch, into));
  else into.push(resolved);
  return into;
}

function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number")
    return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function matchesType(value: unknown, type: string) {
  const kind = kindOf(value);
  return kind === type || (type === "number" && kind === "integer");
}

const show = (value: unknown) => JSON.stringify(value);

/**
 * A repeat's item, standing for a whole value: substituted before the widget
 * renders, so a number stays a number (`RepeatWidget` in types.ts). Inside a
 * template it may stand wherever any value may.
 */
const itemSentinel = /^\{\{\s*item(\.[\w.-]+)?\s*\}\}$/;

/** A union member's `type`, when it is fixed: what picks it out. */
function typeTag(branch: Schema): unknown[] | undefined {
  const tag = branch.properties?.type;
  if (!tag) return undefined;
  if ("const" in tag) return [tag.const];
  return tag.enum;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function check(
  value: unknown,
  node: Schema,
  path: string,
  problems: string[],
  inTemplate = false,
  limit = MAX_PROBLEMS,
): void {
  if (problems.length >= limit) return;
  if (inTemplate && typeof value === "string" && itemSentinel.test(value)) return;
  const resolved = resolve(node);
  if (resolved.anyOf)
    return checkUnion(value, resolved, path, problems, inTemplate, limit);
  if ("const" in resolved && value !== resolved.const) {
    problems.push(`${path}: must be ${show(resolved.const)}, not ${show(value)}.`);
    return;
  }
  if (resolved.enum && !resolved.enum.includes(value)) {
    problems.push(
      `${path}: must be one of ${resolved.enum.map(show).join(", ")}, not ${show(value)}.`,
    );
    return;
  }
  if (resolved.type) {
    const types = Array.isArray(resolved.type) ? resolved.type : [resolved.type];
    if (!types.some((type) => matchesType(value, type))) {
      problems.push(
        `${path}: must be ${types.join(" or ")}, not ${kindOf(value)}${
          record(value) || Array.isArray(value) ? "" : ` (${show(value)})`
        }.`,
      );
      return;
    }
  }
  if (Array.isArray(value) && resolved.items)
    value.forEach((item, i) =>
      check(item, resolved.items!, `${path}[${i}]`, problems, inTemplate, limit),
    );
  if (record(value) && (resolved.properties || resolved.additionalProperties !== undefined)) {
    const properties = resolved.properties ?? {};
    for (const key of resolved.required ?? [])
      if (!(key in value)) problems.push(`${path}: needs "${key}".`);
    for (const [key, item] of Object.entries(value)) {
      const where = `${path}.${key}`;
      const template =
        inTemplate || (key === "template" && value.type === "repeat");
      if (properties[key])
        check(item, properties[key], where, problems, template, limit);
      else if (resolved.additionalProperties === false)
        problems.push(
          `${where}: is not a property here. Known: ${Object.keys(properties).join(", ")}.`,
        );
      else if (record(resolved.additionalProperties))
        check(item, resolved.additionalProperties, where, problems, template, limit);
    }
  }
}

function checkUnion(
  value: unknown,
  node: Schema,
  path: string,
  problems: string[],
  inTemplate: boolean,
  limit: number,
) {
  let candidates = branches(node);
  const tagged = candidates.filter((branch) => typeTag(branch));
  if (record(value) && typeof value.type === "string" && tagged.length) {
    const named = tagged.filter((branch) => typeTag(branch)!.includes(value.type));
    // Only a member that has a `type` of its own (and leaves it free) can be
    // one with a type no member names: a layout container has none.
    const untagged = candidates.filter(
      (branch) =>
        !typeTag(branch) &&
        (!!branch.properties?.type || branch.additionalProperties !== false),
    );
    if (named.length) candidates = named;
    else if (untagged.length) candidates = untagged;
    else {
      const known = tagged.flatMap((branch) => typeTag(branch)!).map(show);
      problems.push(
        `${path}: unknown type ${show(value.type)}. Known: ${[...new Set(known)].join(", ")}.`,
      );
      return;
    }
  } else if (record(value) && !("type" in value) && tagged.length) {
    // A value without a `type` can only be one of the members that need none.
    const untagged = candidates.filter(
      (branch) => !branch.required?.includes("type"),
    );
    if (untagged.length) candidates = untagged;
  }
  const label =
    record(value) && typeof value.type === "string"
      ? `${path} (${value.type})`
      : path;
  let closest: string[] | undefined;
  for (const branch of candidates) {
    const found: string[] = [];
    check(value, branch, label, found, inTemplate, limit);
    if (!found.length) return;
    if (!closest || found.length < closest.length) closest = found;
  }
  for (const problem of closest ?? [`${path}: matches no allowed shape.`])
    if (problems.length < limit) problems.push(problem);
}

/**
 * What is wrong with a facade, each problem with where it is; empty when it
 * matches the schema. `root` names it in what is reported; at most `limit`
 * problems are, eight unless asked.
 */
export function facadeProblems(
  facade: unknown,
  { root = "facade", limit = MAX_PROBLEMS } = {},
): string[] {
  const problems: string[] = [];
  check(facade, definitions.FacadeDescriptor, root, problems, false, limit);
  return problems;
}
