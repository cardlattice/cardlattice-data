import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateCard, validateCatalogue, validateSet, validateSets } from "./validate-schema.ts";

const filename = "catalogue/pokemon/cards/30th-celebration/en/US/001.yaml";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporary(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "cardlattice-schema-"));
  directories.push(directory);
  return directory;
}

describe("Pokémon card schema", () => {
  it("accepts incremental records, comments and the proposed Exeggcute fields", () => {
    expect(validateCard('name: "Exeggcute"\n', filename)).toEqual([]);
    expect(
      validateCard(
        "# Checked card fields\nname: Exeggcute\nrarity: Common\npokemon:\n  category: pokemon\n  hp: 60\n  types: [Grass]\n  stage: Basic\n",
        filename,
      ),
    ).toEqual([]);
    expect(
      validateCard(
        'name: Exeggcute\ncollectorNumber: "001"\nreleaseDate: "2028-02-29"\n',
        filename,
      ),
    ).toEqual([]);
    expect(validateCard("name: Exeggcute\nidentity: pokemon-card-example\n", filename)).toEqual([]);
  });

  it.each([
    ["missing name", "rarity: Common\n"],
    ["blank name", "name: ' '\n"],
    ["misspelled field", "name: Exeggcute\nrairty: Common\n"],
    ["nested typo", "name: Exeggcute\npokemon: {hps: 60}\n"],
    ["HP as a string", "name: Exeggcute\npokemon: {hp: '60'}\n"],
    ["fractional HP", "name: Exeggcute\npokemon: {hp: 60.5}\n"],
    ["HP out of range", "name: Exeggcute\npokemon: {hp: 1001}\n"],
    ["unknown Pokémon type", "name: Exeggcute\npokemon: {types: [Electric]}\n"],
    ["duplicate types", "name: Exeggcute\npokemon: {types: [Grass, Grass]}\n"],
    ["HP on a trainer", "name: Trainer\npokemon: {category: trainer, hp: 60}\n"],
    ["unquoted collector number", "name: Exeggcute\ncollectorNumber: 001\n"],
    ["invalid calendar date", "name: Exeggcute\nreleaseDate: '2026-02-29'\n"],
    ["conflicting attribute locations", "name: Exeggcute\npokemon: {}\nattributes: {}\n"],
    [
      "rules on a shared-identity printing",
      "name: Exeggcute\nidentity: pokemon-card-example\npokemon: {hp: 60}\n",
    ],
    ["duplicate YAML keys", "name: One\nname: Two\n"],
    ["custom YAML tags", "name: !custom Exeggcute\n"],
    ["anchors", "name: &card Exeggcute\n"],
    ["aliases", "name: &card Exeggcute\nrarity: *card\n"],
    ["multiple documents", "name: One\n---\nname: Two\n"],
    ["source evidence", "name: Exeggcute\nsource: unnecessary\n"],
  ])("rejects %s with a filename and location", (_label, yaml) => {
    const errors = validateCard(yaml, filename);
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.every((error) => error.file === filename && error.line > 0 && error.column > 0),
    ).toBe(true);
  });

  it("walks card files and leaves release configuration to the Rust compiler", async () => {
    const directory = await temporary();
    const release = join(directory, "example/en/US");
    await mkdir(release, { recursive: true });
    await writeFile(join(release, "001.yaml"), "name: Exeggcute\n");
    await writeFile(join(release, "release.yaml"), "releaseDate: '2026-01-01'\n");
    expect(await validateCatalogue(directory)).toEqual({ checked: 1, problems: [] });
    await writeFile(join(release, "002.yml"), "name: Wrong extension\n");
    expect((await validateCatalogue(directory)).problems[0].message).toContain(".yaml");
  });

  it("rejects empty catalogues and symlinks", async () => {
    const directory = await temporary();
    expect((await validateCatalogue(directory)).problems[0].message).toContain("No card YAML");
    await symlink(directory, join(directory, "loop"));
    expect(
      (await validateCatalogue(directory)).problems.some((error) =>
        error.message.includes("Symlinks"),
      ),
    ).toBe(true);
  });
});

describe("printed rules and variants", () => {
  it("preserves repeated energy costs, free attacks and non-damaging attacks", () => {
    expect(
      validateCard(
        `name: Example
finishes: [holo, reverse-holo]
stamps: []
pokemon:
  category: pokemon
  attacks:
    - name: Multiple cost
      cost: [Water, Water, Colorless]
      damage: "30×"
    - name: Free effect
      cost: []
      text: Draw a card.
  abilities: []
  weaknesses: [{type: Fire, value: "×2"}]
  resistances: []
  retreatCost: 0
`,
        filename,
      ),
    ).toEqual([]);
  });
  it.each([
    ["unknown finish", "finishes: [shiny]"],
    ["duplicate finish", "finishes: [holo, holo]"],
    ["empty finish", "finishes: []"],
    ["numeric damage", "pokemon: {attacks: [{name: Hit, cost: [], damage: 20}]}"],
    ["missing attack cost", "pokemon: {attacks: [{name: Hit}]}"],
    ["wrong attack energy", "pokemon: {attacks: [{name: Hit, cost: [Electric]}]}"],
    ["unknown attack field", "pokemon: {attacks: [{name: Hit, cost: [], power: 20}]}"],
    ["invalid multiplier", 'pokemon: {attacks: [{name: Hit, cost: [], damage: "20x"}]}'],
    ["trainer attacks", "pokemon: {category: trainer, attacks: []}"],
    ["negative retreat", "pokemon: {retreatCost: -1}"],
    ["unknown weakness type", 'pokemon: {weaknesses: [{type: Electric, value: "×2"}]}'],
    ["duplicate trainer affiliation", "pokemon: {trainers: [hop, hop]}"],
    ["invalid regulation mark", "regulationMark: JJ"],
    ["zero printed denominator", "printedTotal: 0"],
  ])("rejects %s", (_label, fields) => {
    expect(validateCard(`name: Example\n${fields}\n`, filename).length).toBeGreaterThan(0);
  });
});

describe("set schema", () => {
  it("validates inherited defaults and rejects unknown keys", () => {
    expect(
      validateSet(
        "name: Example\ndefaults: {stamps: [anniversary], regulationMark: J, printedTotal: 128}\n",
        "set.yaml",
      ),
    ).toEqual([]);
    expect(
      validateSet("name: Example\ndefaults: {stamp: anniversary}\n", "set.yaml").length,
    ).toBeGreaterThan(0);
    expect(
      validateSet("name: Example\ndefaults: {finishes: [shiny]}\n", "set.yaml").length,
    ).toBeGreaterThan(0);
  });
  it("rejects symlinked and oversized set files", async () => {
    const directory = await temporary();
    await writeFile(join(directory, "example.yaml"), "name: Example\n");
    expect(await validateSets(directory)).toEqual({ checked: 1, problems: [] });
    await symlink(join(directory, "example.yaml"), join(directory, "linked.yaml"));
    await writeFile(join(directory, "huge.yaml"), "x".repeat(1024 * 1024 + 1));
    expect((await validateSets(directory)).problems).toHaveLength(2);
  });
});

describe("canonical enum spellings", () => {
  it.each([
    ["stage typo", "pokemon: {stage: Stage1}"],
    ["stage case", "pokemon: {stage: basic}"],
    ["unknown stage", "pokemon: {stage: Stage 3}"],
    ["subtype typo", "pokemon: {subtypes: [Suporter]}"],
    ["subtype case", "pokemon: {subtypes: [item]}"],
    ["duplicate subtype", "pokemon: {subtypes: [Item, Item]}"],
    ["rarity typo", "rarity: Comon"],
    ["rarity case", "rarity: common"],
    ["rarity alias", "rarity: SIR"],
    ["category alias", "pokemon: {category: Pokémon}"],
    ["type case", "pokemon: {types: [grass]}"],
    ["ability kind case", "pokemon: {abilities: [{name: Example, text: Example., kind: ability}]}"],
    ["finish alias", "finishes: [normal]"],
    ["unknown regulation mark", "regulationMark: Z"],
    ["regulation mark case", "regulationMark: j"],
  ])("rejects %s", (_label, fields) => {
    expect(validateCard(`name: Example\n${fields}\n`, filename).length).toBeGreaterThan(0);
  });
  it("preserves distinct ex and EX mechanics and leaves unknown metadata absent", () => {
    for (const subtype of ["ex", "EX"]) {
      expect(validateCard(`name: Example\npokemon: {subtypes: [${subtype}]}\n`, filename)).toEqual(
        [],
      );
    }
    expect(validateCard("name: Example\n", filename)).toEqual([]);
  });
  it("applies enum validation to set defaults too", () => {
    expect(
      validateSet("name: Example\ndefaults: {regulationMark: Z}\n", "set.yaml").length,
    ).toBeGreaterThan(0);
  });
});

it("reports the allowed spellings when an enum value is wrong", () => {
  const errors = validateCard("name: Example\npokemon: {stage: Stage1}\n", filename);
  expect(errors.some((error) => error.message.includes('"Stage 1"'))).toBe(true);
});
