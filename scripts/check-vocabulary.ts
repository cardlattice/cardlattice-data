import { deepStrictEqual } from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Compare schema definitions, without reading any catalogue records. */
export function checkVocabulary(schema: unknown, compiler: unknown): void {
  const definitions = (schema as { $defs: Record<string, { enum?: string[] }> }).$defs;
  const actual = Object.fromEntries(
    Object.entries(definitions)
      .filter(([, definition]) => Array.isArray(definition.enum))
      .map(([name, definition]) => [name, definition.enum]),
  );
  deepStrictEqual(
    actual,
    compiler,
    "YAML and Rust enum values differ; update schemas and builder-ref.txt together",
  );
}

if (import.meta.main) {
  const filename = process.argv[2];
  if (process.argv.length !== 3 || !filename)
    throw new Error("Usage: check-vocabulary.ts <compiler-vocabulary.json>");
  const schema = JSON.parse(
    await readFile(new URL("../schemas/pokemon-card.schema.json", import.meta.url), "utf8"),
  );
  checkVocabulary(schema, JSON.parse(await readFile(filename, "utf8")));
  console.log("YAML enum definitions match the pinned Rust compiler.");
}
