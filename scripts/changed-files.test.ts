import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { changedFiles } from "./changed-files.ts";
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
  expect(await validateChanged(base, root)).toEqual({
    cards: 2,
    sets: 1,
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
  expect(await validateChanged(base, root)).toEqual({
    cards: 0,
    sets: 0,
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
