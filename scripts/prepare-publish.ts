import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

/** Package the compiler's verified snapshot for the existing public data endpoint. */
export async function preparePublish(root = new URL("../", import.meta.url)) {
  const dist = new URL("dist/", root);
  const manifestBytes = await readFile(new URL("manifest.json", dist));
  const manifest: unknown = JSON.parse(manifestBytes.toString());
  assert(manifest && typeof manifest === "object", "Invalid catalogue manifest");
  assert(
    "filename" in manifest &&
      typeof manifest.filename === "string" &&
      /^catalogue-[a-f0-9]{64}\.json$/.test(manifest.filename),
    "Invalid snapshot filename",
  );
  assert(
    "sourceCommit" in manifest &&
      typeof manifest.sourceCommit === "string" &&
      /^[a-f0-9]{40}$/.test(manifest.sourceCommit),
    "Invalid source revision",
  );
  assert("sha256" in manifest, "Missing snapshot checksum");
  assert(
    "counts" in manifest &&
      manifest.counts &&
      typeof manifest.counts === "object" &&
      "printing" in manifest.counts &&
      Number.isSafeInteger(manifest.counts.printing),
    "Invalid printing count",
  );
  const raw = await readFile(new URL(manifest.filename, dist));
  const checksum = createHash("sha256").update(raw).digest("hex");
  assert.equal(checksum, manifest.sha256, "Snapshot checksum mismatch");
  assert.equal(manifest.filename, `catalogue-${checksum}.json`, "Snapshot filename mismatch");
  assert("byteSize" in manifest, "Missing snapshot byte size");
  assert.equal(raw.byteLength, manifest.byteSize, "Snapshot byte size mismatch");
  const snapshot: unknown = JSON.parse(raw.toString());
  assert(
    snapshot &&
      typeof snapshot === "object" &&
      "sourceCommit" in snapshot &&
      snapshot.sourceCommit === manifest.sourceCommit,
    "Catalogue source revision mismatch",
  );
  assert("records" in snapshot && Array.isArray(snapshot.records), "Invalid snapshot records");
  const printings = snapshot.records.filter((record: unknown) => {
    assert(
      record &&
        typeof record === "object" &&
        "metadata" in record &&
        record.metadata &&
        typeof record.metadata === "object" &&
        "kind" in record.metadata,
      "Invalid snapshot record",
    );
    return record.metadata.kind === "printing";
  });
  assert.equal(printings.length, manifest.counts.printing, "Catalogue printing count mismatch");

  // Recreate this generated directory so previous dashboard assets cannot be published.
  const out = new URL("site/", root);
  await rm(out, { recursive: true, force: true });
  await mkdir(new URL("data/", out), { recursive: true });
  await writeFile(new URL("data/manifest.json", out), manifestBytes);
  await writeFile(new URL(`data/${manifest.filename}`, out), raw);
  await copyFile(new URL("_headers", root), new URL("_headers", out));
  console.log(`Prepared catalogue publication: ${printings.length} printings.`);
}

if (import.meta.main) {
  await preparePublish();
}
