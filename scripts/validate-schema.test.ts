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
    [
      "HP on a Supporter",
      "name: Trainer\npokemon: {category: trainer, subtypes: [Supporter], hp: 60}\n",
    ],
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

  it("validates card files and release configuration", async () => {
    const directory = await temporary();
    const release = join(directory, "example/en/US");
    await mkdir(release, { recursive: true });
    await writeFile(join(release, "001.yaml"), "name: Exeggcute\n");
    await writeFile(join(release, "release.yaml"), "releaseDate: '2026-01-01'\n");
    expect(await validateCatalogue(directory)).toEqual({ checked: 2, problems: [] });
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
    ["zero printed denominator", "printedDenominator: 0"],
  ])("rejects %s", (_label, fields) => {
    expect(validateCard(`name: Example\n${fields}\n`, filename).length).toBeGreaterThan(0);
  });
});

describe("set schema", () => {
  it("validates inherited defaults and rejects unknown keys", () => {
    expect(
      validateSet(
        "name: Example\nstamps: [anniversary]\nregulationMark: J\nprintedDenominator: 128\n",
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

describe("printing relationships and set identifiers", () => {
  it("accepts optional references without changing printing identity", () => {
    expect(
      validateCard(
        "name: Example\nproducts: [pokemon-product-box]\ncollections: [pokemon-collection-family]\nartwork: pokemon-artwork-example\n",
        filename,
      ),
    ).toEqual([]);
    expect(
      validateSet(
        "name: Example\nprintedIdentifiers: [{language: en, region: US, code: LAB}, {language: ja, symbol: laboratory flask}]\n",
        "set.yaml",
      ),
    ).toEqual([]);
  });
  it.each([
    "products: [missing/path]",
    "collections: [one, one]",
    "artwork: []",
    "artwork: 123",
    "products: wrong",
    "pokemon: {artwork: pokemon-artwork-example}",
  ])("rejects malformed relationship fields: %s", (fields) => {
    expect(validateCard(`name: Example\n${fields}\n`, filename).length).toBeGreaterThan(0);
  });
  it.each([
    "[{language: en}]",
    "[{language: en, code: ''}]",
    "[{language: en, region: usa, code: LAB}]",
    "[{language: en, code: LAB, unknown: typo}]",
    "[{language: en, code: LAB}, {language: en, code: OTHER}]",
  ])("rejects malformed printed identifiers: %s", (value) => {
    expect(
      validateSet(`name: Example\nprintedIdentifiers: ${value}\n`, "set.yaml").length,
    ).toBeGreaterThan(0);
  });
});

it("accepts fossil Item HP and Abilities while rejecting them on other Trainers and Energy", () => {
  const fossil =
    "name: Antique Dome Fossil\npokemon:\n  category: trainer\n  subtypes: [Item]\n  hp: 60\n  abilities:\n    - name: Domed Armor\n      kind: Ability\n      text: This Pokémon takes 30 less damage from attacks (after applying Weakness and Resistance).\n";
  expect(validateCard(fossil, filename)).toEqual([]);
  for (const invalid of [
    fossil.replace("[Item]", "[Supporter]"),
    fossil.replace("trainer", "energy"),
    fossil.replace("  hp: 60\n", ""),
    fossil + "  attacks: []\n",
    fossil + "  stage: Basic\n",
  ]) {
    expect(validateCard(invalid, filename).length).toBeGreaterThan(0);
  }
});

describe("schema audit regressions", () => {
  it.each([
    "finishes: []\nstamps: []\nillustrators: []\nprintedDenominator: null\nartwork: null",
    "pokemon: {category: trainer, hp: 10}",
    'pokemon: {category: pokemon, attacks: [{name: Unknown damage, cost: [], damage: "?"}], weaknesses: [{type: Fire}]}',
    "pokemon: {types: []}",
    "pokemon: {category: energy, subtypes: [Special Energy, ACE SPEC]}",
    "variants: {first: {finish: holo, edition: first-edition, products: [pokemon-product-box]}}",
  ])("accepts explicit values: %s", (fields) => {
    expect(validateCard(`name: Example\n${fields}\n`, filename)).toEqual([]);
  });
  it.each([
    "attributes: {}",
    "printingAttributes: {}",
    "printedTotal: 100",
    "finishes: null",
    "variants: {first: {finish: holo, edition: First}}",
    "pokemon: {category: pokemon, subtypes: [Item]}",
    "pokemon: {category: trainer, subtypes: [ex]}",
    "pokemon: {category: energy, subtypes: [Supporter]}",
    "pokemon: {category: trainer, subtypes: [Supporter], hp: 10}",
  ])("rejects aliases, invalid clearing and category mismatches: %s", (fields) => {
    expect(validateCard(`name: Example\n${fields}\n`, filename).length).toBeGreaterThan(0);
  });
});

it("validates explicit variant combinations as well as their field types", () => {
  for (const fields of [
    "finishes: [non-holo]\nvariants: {first: {finish: holo}}",
    "variants: {first: {finish: holo}, second: {finish: holo}}",
    "variants: {first: {finish: holo, stamps: [one, two]}, second: {finish: holo, stamps: [two, one]}}",
  ])
    expect(validateCard(`name: Example\n${fields}`, filename).length).toBeGreaterThan(0);
});

it("checks canonical language and region spellings in printing paths", () => {
  for (const locale of ["en/us", "EN/US", "english/US", "zh-hant/US"]) {
    expect(
      validateCard("name: Example", `catalogue/pokemon/cards/example/${locale}/001.yaml`).length,
    ).toBeGreaterThan(0);
  }
  for (const locale of ["en/US", "nl/global", "zh-Hant/TW", "es-419/global"]) {
    expect(
      validateCard("name: Example", `catalogue/pokemon/cards/example/${locale}/001.yaml`),
    ).toEqual([]);
  }
});

it("preserves native printed Pokédex text and measurements", () => {
  expect(
    validateCard(
      "name: Original synthetic card\npokemon: {category: pokemon, flavourText: Original synthetic text., species: Original synthetic species, heightMetres: 0.3, weightKilograms: 1.5}",
      filename,
    ),
  ).toEqual([]);
  for (const field of [
    "heightMetres: -1",
    "weightKilograms: 1000001",
    "heightMetres: '0.3m'",
    "species: ' '",
    "flavourText: ' '",
  ]) {
    expect(
      validateCard(`name: Original synthetic card\npokemon: {${field}}`, filename).length,
    ).toBeGreaterThan(0);
  }
  expect(
    validateCard(
      "name: Original synthetic trainer\npokemon: {category: trainer, heightMetres: 0.3}",
      filename,
    ).length,
  ).toBeGreaterThan(0);
  for (const rarity of [
    "C",
    "U",
    "R",
    "RR",
    "SR",
    "AR",
    "SAR",
    "RRR",
    "HR",
    "UR",
    "S",
    "SSR",
    "PR",
    "FUR",
    "●",
    "◆",
    "★",
    "★★",
    "★★★",
  ])
    expect(validateCard(`name: Original synthetic card\nrarity: ${rarity}`, filename)).toEqual([]);
});

it("preserves numeric printed levels and separate anniversary numbering", () => {
  expect(
    validateCard(
      'name: Original synthetic card\npokemon: {category: pokemon, level: 12}\nadditionalNumbers: {pikachu30th: "09/30"}',
      filename,
    ),
  ).toEqual([]);
  for (const field of [
    "pokemon: {level: 0}",
    "pokemon: {level: 101}",
    'pokemon: {level: "12"}',
    "pokemon: {category: trainer, level: 12}",
    "pokemon: {category: energy, level: 12}",
    "additionalNumbers: {}",
    'additionalNumbers: {pikachu: "09/30"}',
    'additionalNumbers: {pikachu30th: "00/30"}',
    'additionalNumbers: {pikachu30th: "31/30"}',
    'additionalNumbers: {pikachu30th: "9/30"}',
    'additionalNumbers: {pikachu30th: "09/31"}',
  ])
    expect(
      validateCard(`name: Original synthetic card\n${field}`, filename).length,
    ).toBeGreaterThan(0);
});

it("preserves real printed code punctuation while rejecting whitespace damage", () => {
  for (const code of ["SM4+", "30th C", "SM-P"])
    expect(
      validateSet(
        `name: Example\nprintedIdentifiers: [{language: ja, code: "${code}"}]`,
        "set.yaml",
      ),
    ).toEqual([]);
  for (const code of [" SM4+", "30th C ", "SM4/1"])
    expect(
      validateSet(
        `name: Example\nprintedIdentifiers: [{language: ja, code: "${code}"}]`,
        "set.yaml",
      ).length,
    ).toBeGreaterThan(0);
});

it("accepts explicit unnumbered printings without authoring compiler identity fields", () => {
  expect(
    validateCard(
      "name: Original synthetic energy\ncollectorNumber: null\nprintedDenominator: null\npokemon: {category: energy, subtypes: [Basic Energy]}",
      "catalogue/pokemon/cards/example/ja/JP/grass-energy.yaml",
    ),
  ).toEqual([]);
  expect(
    validateCard(
      "name: Original synthetic energy\ncollectorNumber: null\nunnumberedKey: forged",
      filename,
    ).length,
  ).toBeGreaterThan(0);
  for (const value of ["top", "bottom"])
    expect(
      validateCard(
        `name: Original synthetic half\nlegendPart: ${value}\npokemon: {category: pokemon, stage: LEGEND, subtypes: [LEGEND]}`,
        filename,
      ),
    ).toEqual([]);
  expect(
    validateCard("name: Original synthetic half\nlegendPart: middle", filename).length,
  ).toBeGreaterThan(0);
  expect(
    validateCard(
      "name: Original synthetic level-up\npokemon: {category: pokemon, stage: Level-Up, subtypes: [LV.X]}",
      filename,
    ),
  ).toEqual([]);
  expect(
    validateCard(
      "name: Original synthetic trainer\npokemon: {category: trainer, subtypes: [LV.X]}",
      filename,
    ).length,
  ).toBeGreaterThan(0);
});
