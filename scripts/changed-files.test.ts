import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { changedFiles } from "./changed-files.ts";
import { catalogueBuildNeeded } from "./catalogue-build-needed.ts";
import { validateChanged } from "./validate-schema.ts";

const execute = promisify(execFile);
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const cardDirectory = "catalogue/pokemon/cards/example/en/US";
async function git(root: string, ...args: string[]) {
  return (await execute("git", args, { cwd: root })).stdout.trim();
}
async function commit(root: string) {
  await git(root, "add", ".");
  await git(
    root,
    "-c",
    "user.name=Schema Test",
    "-c",
    "user.email=schema@example.invalid",
    "commit",
    "-qm",
    "test",
  );
  return git(root, "rev-parse", "HEAD");
}
async function repository() {
  const root = await mkdtemp(join(tmpdir(), "cardlattice-changed-"));
  temporary.push(root);
  await git(root, "init", "-q", "--initial-branch=main");
  await mkdir(join(root, cardDirectory), { recursive: true });
  await writeFile(join(root, cardDirectory, "001.yaml"), "name: Original\n");
  // Deliberately invalid unchanged data proves the PR command does not scan everything.
  await writeFile(join(root, cardDirectory, "002.yaml"), "name: Old\nunknown: field\n");
  return { root, base: await commit(root) };
}

it("validates only added and modified card/set files", async () => {
  const { root, base } = await repository();
  await writeFile(join(root, cardDirectory, "001.yaml"), "name: Changed\nfinishes: [holo]\n");
  await writeFile(join(root, cardDirectory, "003.yaml"), "name: Added\n");
  await mkdir(join(root, "catalogue/pokemon/sets"), { recursive: true });
  await writeFile(join(root, "catalogue/pokemon/sets/example.yaml"), "name: Example\n");
  await commit(root);
  expect(await catalogueBuildNeeded(base, root)).toBe(true);
  expect(await validateChanged(base, root)).toEqual({
    cards: 2,
    sets: 1,
    definitions: 0,
    deleted: 0,
    problems: [],
  });
});

it("validates rename destinations and skips deleted files", async () => {
  const { root, base } = await repository();
  await rename(join(root, cardDirectory, "002.yaml"), join(root, cardDirectory, "003.yaml"));
  await rm(join(root, cardDirectory, "001.yaml"));
  await commit(root);
  const result = await validateChanged(base, root);
  expect(result.cards).toBe(1);
  expect(result.deleted).toBe(1);
  expect(result.problems[0].file).toBe(`${cardDirectory}/003.yaml`);
});

it("checks no data for documentation-only changes and fails closed on invalid refs", async () => {
  const { root, base } = await repository();
  await writeFile(join(root, "README.md"), "Example\n");
  await commit(root);
  expect(await catalogueBuildNeeded(base, root)).toBe(false);
  expect(await validateChanged(base, root)).toEqual({
    cards: 0,
    sets: 0,
    definitions: 0,
    deleted: 0,
    problems: [],
  });
  await expect(changedFiles("--output=unexpected", root)).rejects.toThrow("commit SHA");
  await expect(changedFiles("0".repeat(40), root)).rejects.toThrow();
});

it("rejects unexpected changed paths instead of silently ignoring them", async () => {
  const { root, base } = await repository();
  await writeFile(join(root, cardDirectory, "003.yml"), "name: Wrong extension\n");
  await commit(root);
  expect((await validateChanged(base, root)).problems[0].message).toContain("Unexpected");
});

it("validates changed relationship definitions without reading unchanged cards", async () => {
  const { root, base } = await repository();
  await mkdir(join(root, "catalogue/pokemon/products"), { recursive: true });
  await writeFile(
    join(root, "catalogue/pokemon/products/box.yaml"),
    "name: Example box\nrelatedSets: [pokemon-example]\n",
  );
  await commit(root);
  const result = await validateChanged(base, root);
  expect(result.cards).toBe(0);
  expect(result.definitions).toBe(1);
  expect(result.problems).toEqual([]);
  await writeFile(
    join(root, "catalogue/pokemon/products/box.yaml"),
    "name: Example box\nrelatedSets: [pokemon-example, pokemon-example]\n",
  );
  await commit(root);
  expect((await validateChanged(base, root)).problems.length).toBeGreaterThan(0);
});

it("validates changed games, series, identities and releases without scanning old cards", async () => {
  const { root, base } = await repository();
  const files = {
    "catalogue/pokemon/game.yaml": "name: Pokémon\n",
    "catalogue/pokemon/series/example.yaml": "name: Example\n",
    "catalogue/pokemon/identities/example.yaml":
      "localisations: {en: {name: Example, pokemon: {hp: 60}}, nl: {name: Example, pokemon: {hp: 60}}}\n",
    [`${cardDirectory}/release.yaml`]: "printedDenominator: 102\nfinishes: [holo]\n",
  };
  for (const [file, text] of Object.entries(files)) {
    await mkdir(join(root, file, ".."), { recursive: true });
    await writeFile(join(root, file), text);
  }
  await commit(root);
  const result = await validateChanged(base, root);
  expect(result).toEqual({ cards: 0, sets: 0, definitions: 4, deleted: 0, problems: [] });
  for (const file of Object.keys(files)) await writeFile(join(root, file), "unexpected: true\n");
  await commit(root);
  expect(new Set((await validateChanged(base, root)).problems.map((p) => p.file)).size).toBe(4);
});

it("requires catalogue builds for deletions and renames into documentation", async () => {
  const { root, base } = await repository();
  await rename(join(root, cardDirectory, "001.yaml"), join(root, "README.md"));
  await commit(root);
  expect(await catalogueBuildNeeded(base, root)).toBe(true);
  await rm(join(root, cardDirectory, "002.yaml"));
  const deletionBase = await git(root, "rev-parse", "HEAD");
  await commit(root);
  expect(await catalogueBuildNeeded(deletionBase, root)).toBe(true);
});

it.each([
  "builder-ref.txt",
  "schemas/new.json",
  "scripts/build.sh",
  ".github/workflows/catalogue.yml",
  "pnpm-lock.yaml",
  "status/client.js",
  "unknown-input",
  "catalogue/README.md",
])("requires a build when %s changes alongside documentation", async (path) => {
  const { root, base } = await repository();
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), "changed\n");
  await writeFile(join(root, "README.md"), "Documentation\n");
  await commit(root);
  expect(await catalogueBuildNeeded(base, root)).toBe(true);
});

it("skips nested documentation changes but rejects missing or invalid base commits", async () => {
  const { root, base } = await repository();
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "guide with spaces.md"), "Guide\n");
  await commit(root);
  expect(await catalogueBuildNeeded(base, root)).toBe(false);
  await expect(catalogueBuildNeeded("main", root)).rejects.toThrow("full Git commit SHA");
  await expect(catalogueBuildNeeded("0".repeat(40), root)).rejects.toThrow();
});
