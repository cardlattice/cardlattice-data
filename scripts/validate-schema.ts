import { readFile, readdir, lstat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { fullFormats } from "ajv-formats/dist/formats.js";
import { isAlias, isNode, LineCounter, parseDocument, visit } from "yaml";

import { changedFiles } from "./changed-files.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const schema = JSON.parse(await readFile(join(root, "schemas/pokemon-card.schema.json"), "utf8"));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  coerceTypes: false,
  useDefaults: false,
  formats: { date: fullFormats.date },
});
const validate = ajv.compile(schema);
const setSchema = JSON.parse(await readFile(join(root, "schemas/pokemon-set.schema.json"), "utf8"));
const validateSetSchema = ajv.compile(setSchema);
const definitionKinds = ["product", "collection", "artwork"] as const;
type DefinitionKind = (typeof definitionKinds)[number];
const definitionValidators = Object.fromEntries(
  await Promise.all(
    definitionKinds.map(async (kind) => [
      kind,
      ajv.compile(
        JSON.parse(await readFile(join(root, `schemas/pokemon-${kind}.schema.json`), "utf8")),
      ),
    ]),
  ),
);
export function validateDefinition(kind: DefinitionKind, text: string, file: string): Problem[] {
  return validateDocument(text, file, definitionValidators[kind]);
}
export async function validateDefinitions(directory = join(root, "catalogue/pokemon")) {
  const problems: Problem[] = [];
  let checked = 0;
  for (const kind of definitionKinds) {
    const folder = join(directory, `${kind}s`);
    try {
      await lstat(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (!(await lstat(folder)).isDirectory() || (await lstat(folder)).isSymbolicLink()) {
      problems.push({
        file: folder,
        line: 1,
        column: 1,
        message: "Expected a regular definition directory",
      });
      continue;
    }
    for (const name of (await readdir(folder)).sort()) {
      const path = join(folder, name);
      const metadata = await lstat(path);
      if (!metadata.isFile() || !name.endsWith(".yaml") || metadata.size > 1024 * 1024) {
        problems.push({
          file: path,
          line: 1,
          column: 1,
          message: "Expected a regular definition YAML file of at most 1 MiB",
        });
        continue;
      }
      checked += 1;
      problems.push(...validateDefinition(kind, await readFile(path, "utf8"), path));
    }
  }
  return { checked, problems };
}

export type Problem = { file: string; line: number; column: number; message: string };

function fieldMessage(error: ErrorObject): string {
  const path = error.instancePath || "/";
  if (error.keyword === "additionalProperties") {
    return `${path}: unknown field ${JSON.stringify(error.params.additionalProperty)}`;
  }
  if (error.keyword === "enum") {
    return `${path}: expected one of ${error.params.allowedValues.map((value: unknown) => JSON.stringify(value)).join(", ")}`;
  }
  return `${path}: ${error.message}`;
}

export function validateCard(text: string, file: string): Problem[] {
  return validateDocument(text, file, validate);
}
export function validateSet(text: string, file: string): Problem[] {
  const problems = validateDocument(text, file, validateSetSchema);
  if (problems.length) return problems;
  const value = parseDocument(text).toJS() as {
    printedIdentifiers?: { language: string; region?: string }[];
  };
  const scopes = new Set<string>();
  for (const mark of value.printedIdentifiers ?? []) {
    const scope = JSON.stringify([mark.language, mark.region ?? null]);
    if (scopes.has(scope))
      problems.push({
        file,
        line: 1,
        column: 1,
        message: "Duplicate language/region scope in printedIdentifiers",
      });
    scopes.add(scope);
  }
  return problems;
}
function validateDocument(
  text: string,
  file: string,
  validate: typeof validateSetSchema,
): Problem[] {
  if (Buffer.byteLength(text, "utf8") > 1024 * 1024) {
    return [{ file, line: 1, column: 1, message: "YAML file exceeds 1 MiB" }];
  }
  const lineCounter = new LineCounter();
  const document = parseDocument(text, {
    version: "1.2",
    schema: "core",
    strict: true,
    uniqueKeys: true,
    lineCounter,
  });
  const problems: Problem[] = [...document.errors, ...document.warnings].map((error) => ({
    file,
    ...lineCounter.linePos(error.pos[0]),
    column: lineCounter.linePos(error.pos[0]).col,
    message: error.message,
  }));
  if (problems.length) return problems;
  visit(document, (_key, node) => {
    if (isAlias(node) || (isNode(node) && "anchor" in node && node.anchor)) {
      const position = lineCounter.linePos(node.range?.[0] ?? 0);
      problems.push({
        file,
        line: position.line,
        column: position.col,
        message: "YAML anchors and aliases are not allowed",
      });
    }
  });
  if (problems.length) return problems;
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => {
    const keys = error.instancePath
      .split("/")
      .slice(1)
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
    const node = document.getIn(keys, true);
    const position = lineCounter.linePos(isNode(node) ? (node.range?.[0] ?? 0) : 0);
    return { file, line: position.line, column: position.col, message: fieldMessage(error) };
  });
}

export async function validateCatalogue(
  directory = join(root, "catalogue/pokemon/cards"),
): Promise<{ checked: number; problems: Problem[] }> {
  const problems: Problem[] = [];
  let checked = 0;
  async function walk(path: string, depth: number): Promise<void> {
    const file = relative(root, path).split(sep).join("/");
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || depth > 5) {
      problems.push({
        file,
        line: 1,
        column: 1,
        message: "Symlinks and unexpected directory depth are not allowed",
      });
    } else if (metadata.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) await walk(join(path, entry), depth + 1);
    } else if (path.endsWith(`${sep}release.yaml`)) {
      // Release configuration is validated by the existing Rust compiler, not the card schema.
    } else if (!path.endsWith(".yaml") || depth !== 4) {
      problems.push({
        file,
        line: 1,
        column: 1,
        message: "Expected <set>/<language>/<region>/<number>.yaml",
      });
    } else {
      checked += 1;
      if (metadata.size > 1024 * 1024)
        problems.push({ file, line: 1, column: 1, message: "Card file exceeds 1 MiB" });
      else problems.push(...validateCard(await readFile(path, "utf8"), file));
    }
  }
  await walk(directory, 0);
  if (checked === 0)
    problems.push({
      file: relative(root, directory),
      line: 1,
      column: 1,
      message: "No card YAML files found",
    });
  return { checked, problems };
}

export async function validateSets(directory = join(root, "catalogue/pokemon/sets")) {
  const problems: Problem[] = [];
  let checked = 0;
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    const file = relative(root, path);
    const metadata = await lstat(path);
    if (!metadata.isFile() || !name.endsWith(".yaml") || metadata.size > 1024 * 1024) {
      problems.push({
        file,
        line: 1,
        column: 1,
        message: "Expected a regular set YAML file of at most 1 MiB",
      });
      continue;
    }
    checked += 1;
    problems.push(...validateSet(await readFile(path, "utf8"), file));
  }
  if (!checked)
    problems.push({ file: directory, line: 1, column: 1, message: "No set YAML files found" });
  return { checked, problems };
}

export async function validateChanged(base: string, directory = root) {
  const changed = await changedFiles(base, directory);
  const problems: Problem[] = [];
  let cards = 0;
  let sets = 0;
  let definitions = 0;
  for (const file of changed.files) {
    if (!/^catalogue\/pokemon\/(cards|sets|products|collections|artworks)\//.test(file)) continue;
    const definition = /^catalogue\/pokemon\/(product|collection|artwork)s\/[^/]+\.yaml$/.exec(
      file,
    )?.[1] as DefinitionKind | undefined;
    const card = /^catalogue\/pokemon\/cards\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.yaml$/.test(file);
    const set = /^catalogue\/pokemon\/sets\/[^/]+\.yaml$/.test(file);
    if (!card && !set && !definition) {
      problems.push({ file, line: 1, column: 1, message: "Unexpected card/set path or extension" });
      continue;
    }
    // Release configuration remains checked by the Rust preview build.
    if (card && file.endsWith("/release.yaml")) continue;
    const path = join(directory, file);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.size > 1024 * 1024) {
      problems.push({
        file,
        line: 1,
        column: 1,
        message: "Expected a regular YAML file of at most 1 MiB",
      });
      continue;
    }
    const source = await readFile(path, "utf8");
    if (card) {
      cards += 1;
      problems.push(...validateCard(source, file));
    } else if (definition) {
      definitions += 1;
      problems.push(...validateDefinition(definition, source, file));
    } else {
      sets += 1;
      problems.push(...validateSet(source, file));
    }
  }
  return { cards, sets, definitions, deleted: changed.deleted, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let result: { cards: number; sets: number; definitions: number; problems: Problem[] };
  if (args.length === 2 && args[0] === "--changed-from") {
    result = await validateChanged(args[1]);
  } else if (args.length === 0) {
    const cards = await validateCatalogue();
    const sets = await validateSets();
    const definitions = await validateDefinitions();
    result = {
      cards: cards.checked,
      sets: sets.checked,
      definitions: definitions.checked,
      problems: [...cards.problems, ...sets.problems, ...definitions.problems],
    };
  } else throw new Error("Usage: validate-schema.ts [--changed-from <base-commit-sha>]");
  for (const problem of result.problems) {
    console.error(`${problem.file}:${problem.line}:${problem.column}: ${problem.message}`);
  }
  if (result.problems.length) {
    console.error(`Schema validation failed with ${result.problems.length} error(s).`);
    process.exitCode = 1;
  } else
    console.log(
      `Schema validation passed for ${result.cards} Pokémon cards and ${result.sets} sets and ${result.definitions} relationship definitions.`,
    );
}
