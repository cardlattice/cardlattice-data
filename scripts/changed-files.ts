import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function changedFiles(base: string, directory: string) {
  if (!/^[a-f0-9]{40}$/.test(base))
    throw new Error("Changed-file base must be a full Git commit SHA");
  const { stdout } = await execute(
    "git",
    ["diff", "--name-status", "-z", "--find-renames", `${base}...HEAD`, "--", "catalogue/"],
    { cwd: directory, maxBuffer: 16 * 1024 * 1024 },
  );
  const fields = stdout.split("\0");
  const files: string[] = [];
  let deleted = 0;
  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    let path = fields[index++];
    if (status.startsWith("R") || status.startsWith("C")) path = fields[index++];
    if (status === "D") deleted += 1;
    else if (/^[AMTRC]/.test(status)) files.push(path);
    else throw new Error(`Unsupported Git change status: ${status}`);
  }
  return { files: [...new Set(files)].sort(), deleted };
}
