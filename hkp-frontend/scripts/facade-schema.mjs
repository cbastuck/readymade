// Writes src/facade/facade.schema.json from src/facade/types.ts: the schema
// Board Assist checks a proposed facade against (src/facade/validateFacade.ts).
// Run after changing types.ts: `npm run facade-schema`. A test fails while the
// two disagree.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";

/** The schema of `FacadeDescriptor` in the `types.ts` at `types`. */
export function facadeSchema(types) {
  return createGenerator({
    path: types,
    type: "FacadeDescriptor",
    skipTypeCheck: true,
    expose: "export",
    topRef: true,
    jsDoc: "none",
  }).createSchema("FacadeDescriptor");
}

export const serialize = (schema) => `${JSON.stringify(schema, null, 2)}\n`;

const self = import.meta.url.startsWith("file:")
  ? fileURLToPath(import.meta.url)
  : undefined;
if (self && process.argv[1] === self) {
  const facade = join(dirname(self), "../src/facade");
  const out = join(facade, "facade.schema.json");
  writeFileSync(out, serialize(facadeSchema(join(facade, "types.ts"))));
  console.log(`Wrote ${out}`);
}
