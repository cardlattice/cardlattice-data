import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { preparePublish } from "./prepare-publish.ts";

const execute = promisify(execFile);
const directories: URL[] = [];
const revision = "a".repeat(40);
const snapshot = {
  sourceCommit: revision,
  records: [
    { id: "set", metadata: { kind: "set" } },
    { id: "printing", metadata: { kind: "printing", setId: "set" } },
  ],
};
async function fixture(overrides: object = {}, content: unknown = snapshot) {
  const root = pathToFileURL((await mkdtemp(join(tmpdir(), "catalogue-publish-"))) + sep);
  directories.push(root);
  await mkdir(new URL("dist/", root));
  await mkdir(new URL("site/", root));
  await writeFile(new URL("site/index.html", root), "stale dashboard");
  const raw = JSON.stringify(content);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const manifest = {
    filename: `catalogue-${sha256}.json`,
    sha256,
    sourceCommit: revision,
    byteSize: Buffer.byteLength(raw),
    counts: { printing: 1 },
    ...overrides,
  };
  await writeFile(new URL("dist/manifest.json", root), JSON.stringify(manifest));
  await writeFile(new URL(`dist/catalogue-${sha256}.json`, root), raw);
  await copyFile(new URL("../_headers", import.meta.url), new URL("_headers", root));
  return { root, manifest, raw };
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
it("publishes identical data bytes and CORS/cache headers without stale dashboard files", async () => {
  const { root, manifest, raw } = await fixture();
  await preparePublish(root);
  expect(await readdir(new URL("site/", root))).toEqual(["_headers", "data"]);
  expect(await readdir(new URL("site/data/", root))).toEqual([manifest.filename, "manifest.json"]);
  expect(await readFile(new URL(`site/data/${manifest.filename}`, root), "utf8")).toBe(raw);
  expect(await readFile(new URL("site/data/manifest.json", root), "utf8")).toBe(
    await readFile(new URL("dist/manifest.json", root), "utf8"),
  );
  const headers = await readFile(new URL("site/_headers", root), "utf8");
  expect(headers).toBe(await readFile(new URL("_headers", root), "utf8"));
  expect(headers).toContain("Access-Control-Allow-Origin: *");
  expect(headers).toContain("Cache-Control: no-cache, must-revalidate");
  expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
  await preparePublish(root);
  expect(await readdir(new URL("site/", root))).toEqual(["_headers", "data"]);
});
it("runs the package entry point against its own repository root", async () => {
  const { root } = await fixture();
  await mkdir(new URL("scripts/", root));
  const script = new URL("scripts/prepare-publish.ts", root);
  await copyFile(new URL("prepare-publish.ts", import.meta.url), script);
  const { stdout } = await execute(process.execPath, [fileURLToPath(script)]);
  expect(stdout).toContain("1 printings");
  expect(await readdir(new URL("site/", root))).toEqual(["_headers", "data"]);
});
it.each([
  [{ filename: "../secret" }, "Invalid snapshot filename"],
  [{ sourceCommit: "main" }, "Invalid source revision"],
  [{ sha256: "b".repeat(64) }, "Snapshot checksum mismatch"],
  [{ byteSize: 1 }, "Snapshot byte size mismatch"],
  [{ counts: { printing: 2 } }, "Catalogue printing count mismatch"],
  [{ counts: { printing: "1" } }, "Invalid printing count"],
])(
  "rejects invalid manifest metadata %j before changing the published directory",
  async (overrides, message) => {
    const { root } = await fixture(overrides);
    await expect(preparePublish(root)).rejects.toThrow(message);
    expect(await readFile(new URL("site/index.html", root), "utf8")).toBe("stale dashboard");
  },
);
it.each([
  null,
  { sourceCommit: "b".repeat(40), records: [] },
  { sourceCommit: revision },
  { sourceCommit: revision, records: "invalid" },
  { sourceCommit: revision, records: [null] },
  { sourceCommit: revision, records: [{ metadata: null }] },
  { sourceCommit: revision, records: [{ metadata: {} }] },
])("rejects checksum-valid malformed snapshots %j", async (content) => {
  const { root } = await fixture({}, content);
  await expect(preparePublish(root)).rejects.toThrow();
});
it("rejects a snapshot renamed to a different content hash", async () => {
  const { root, raw } = await fixture({ filename: `catalogue-${"b".repeat(64)}.json` });
  await writeFile(new URL(`dist/catalogue-${"b".repeat(64)}.json`, root), raw);
  await expect(preparePublish(root)).rejects.toThrow("Snapshot filename mismatch");
});
it.each([null, {}, { filename: "catalogue-" + "a".repeat(64) + ".json" }])(
  "rejects incomplete manifests %j",
  async (manifest) => {
    const { root } = await fixture();
    await writeFile(new URL("dist/manifest.json", root), JSON.stringify(manifest));
    await expect(preparePublish(root)).rejects.toThrow();
  },
);
it("rejects a snapshot modified after compilation", async () => {
  const { root, manifest } = await fixture();
  await writeFile(new URL(`dist/${manifest.filename}`, root), "modified");
  await expect(preparePublish(root)).rejects.toThrow("Snapshot checksum mismatch");
});
