import { describe, expect, it } from "vitest";
import { checkVocabulary } from "./check-vocabulary.ts";

describe("schema/compiler enum contract", () => {
  const schema = { $defs: { stage: { enum: ["Basic", "Stage 1"] }, card: { type: "object" } } };
  it("accepts matching enums without scanning data", () => {
    expect(() => checkVocabulary(schema, { stage: ["Basic", "Stage 1"] })).not.toThrow();
  });
  it.each([
    { stage: ["basic", "Stage 1"] },
    { stage: ["Basic"] },
    { stage: ["Basic", "Stage 1", "Unknown"] },
    {},
    { stage: ["Basic", "Stage 1"], extra: ["value"] },
  ])("rejects drift in either direction: %j", (compiler) => {
    expect(() => checkVocabulary(schema, compiler)).toThrow("YAML and Rust enum values differ");
  });
});
