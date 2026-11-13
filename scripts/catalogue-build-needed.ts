import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function catalogueBuildNeeded(base: string, directory: string): Promise<boolean> {
  if (!/^[a-f0-9]{40}$/.test(base))
    throw new Error("Changed-file base must be a full Git commit SHA");
  // Disable rename detection so both the old and new paths are checked.
  const { stdout } = await execute(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", `${base}...HEAD`, "--"],
    { cwd: directory, maxBuffer: 16 * 1024 * 1024 },
  );
  // Only explicitly recognised documentation can skip the build. New inputs,
  // deleted catalogue files and changes to CI itself always require a build.
  return stdout
    .split("\0")
    .filter(Boolean)
    .some((path) => !/^[^/]+\.md$/.test(path) && !/^docs\/.*\.md$/.test(path));
}

if (import.meta.main) {
  const base = process.argv[2];
  if (process.argv.length !== 3 || !base || !process.env.GITHUB_OUTPUT)
    throw new Error("Usage: catalogue-build-needed.ts <base-sha> (requires GITHUB_OUTPUT)");
  const needed = await catalogueBuildNeeded(base, process.cwd());
  await appendFile(process.env.GITHUB_OUTPUT, `needed=${needed}\n`);
  console.log(
    needed
      ? "Catalogue inputs changed: build required."
      : "Documentation-only PR: skipping catalogue build.",
  );
}
