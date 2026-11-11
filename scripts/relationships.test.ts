import { describe, expect, it } from "vitest";
import { validateDefinition } from "./validate-schema.ts";

describe("relationship definitions", () => {
  it.each(["product", "collection", "artwork"] as const)(
    "accepts incremental %s metadata",
    (kind) => {
      expect(validateDefinition(kind, "name: Synthetic example\n", "example.yaml")).toEqual([]);
    },
  );
  it.each([
    ["product", "relatedSets: [pokemon-one, pokemon-one]"],
    ["collection", "relatedSets: [bad/path]"],
    ["artwork", "illustrators: [Artist, Artist]"],
    ["artwork", "image: https://example.invalid/unreviewed.jpg"],
    ["product", "relatedSet: pokemon-one"],
    ["collection", "name: duplicate key"],
  ] as const)("rejects invalid %s metadata: %s", (kind, fields) => {
    expect(
      validateDefinition(kind, `name: Synthetic example\n${fields}\n`, "example.yaml").length,
    ).toBeGreaterThan(0);
  });
});
