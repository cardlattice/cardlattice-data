# Contributing catalogue facts

For a name correction, edit one
`catalogue/<game>/cards/<set>/<language>/<region>/<number>.yaml` file and open a PR.
GitHub's web editor is sufficient. No source description, citation, evidence file
or local development environment is required. Do not copy a third-party catalogue.

## Card fields

A file needs only `name`. This fictional example illustrates optional fields:

```yaml
name: "Prism Seed"
rarity: "Common"
finishes: [holo]
pokemon:
  category: pokemon
  hp: 70
  types: [Lightning]
  stage: Basic
  attacks:
    - name: Spark
      cost: [Lightning, Colorless]
      damage: "20"
  retreatCost: 1
```

- `collectorNumber`: override the filename when the printed number contains a
  character unsuitable for filenames, e.g. `"A/001"`. Keep the filename stable.
- `releaseDate`: override the release or set date, in quoted `"YYYY-MM-DD"` form.
- `pokemon`: `category`, `hp`, `types`, `stage`, `evolvesFrom`, `attacks`,
  `abilities`, `weaknesses`, `resistances`, `retreatCost`, `subtypes`, `rules`,
  `nationalDex` and `trainers`. Leave unknown facts absent. `trainers` describes
  named Trainer affiliations on the card, not who owns a physical copy.
- `finishes`: confirmed options from `non-holo`, `holo`, `reverse-holo`. Rarity
  does not imply a finish. This list does not describe foil patterns.
- `stamps`: stable, readable names such as `30th-anniversary`.
- `regulationMark`, `printedDenominator`, `illustrators`: printed details. The denominator
  is separate from the number of cards catalogued; secret cards may exceed it.
- `externalIds`: optional namespace/value identifiers from other systems.
- `identity`: an existing shared card identity, when rules equivalence has been
  established. Otherwise omit it and let the compiler generate one.

Do not add `id`, `gameId`, `setId` or `identityScope`; the compiler generates them.
A name correction must not rename the file or change its canonical key. Regions
use their explicit code, or `global` when there is no region value. Keep language
tags in the directory, e.g. `en`, `ja` or `pt-BR`.

Attacks retain printed order. `cost` is an array of energy type names, including
repeated entries; `[]` means a free attack. Quote `damage`, including plain numbers,
so `"20"`, `"30+"`, `"20×"` and a printed `"?"` are strings. Omit damage for effect-only attacks.
Use `text` for the effect. An ability has `name`, `text`, and `kind` (`Ability`,
`Pokémon Power`, `Poké-Power`, or `Poké-Body`). Energy symbols in text use names;
repeated standalone symbols can be written `{Colorless}{Colorless}`.

Weaknesses/resistances are lists such as `[{type: Fire, value: "×2"}]`.
If only a type symbol is printed, use `[{type: Fire}]`; do not invent a modifier.
`retreatCost` counts Colorless energy symbols. `subtypes` includes printed mechanics
such as `ex` or Trainer categories such as `Item`. `rules` contains ordered rule
paragraphs. Trainer/Energy records cannot carry Pokémon attacks or retreat costs.
Historical Trainers such as Fossils and Clefairy Doll may have printed `hp`
without a subtype. Modern Fossil Items can use `subtypes: [Item]`. Both may
include printed abilities when HP is present. Do not retrofit modern Item labels
onto older cards. Other Trainer subtypes and Energy records cannot carry HP or
abilities. Subtypes are also checked against category: e.g. a Pokémon cannot be
an Item, and an Energy cannot be a Supporter.

An omitted list is unknown; an empty list confirms none. Do not fill missing facts
by inference from the name, another printing or the Pokémon species.

## Add a set or release

Add `catalogue/<game>/sets/<set-key>.yaml`:

```yaml
name: "Laboratory"
printedDenominator: 128
stamps: [laboratory-anniversary]
regulationMark: J
```

Set-wide printing fields live directly on the set, not under a defaults wrapper.
The same fields can be supplied in a release file or a card: `finishes`, `stamps`,
`regulationMark`, `printedDenominator`, `illustrators`, `products`, `collections`,
`artwork` and `variants`. Use set values only when they apply across releases.

Precedence is **card > release > set**. An omitted field inherits; a list replaces
its parent list, and `[]` explicitly clears it. `null` clears an inherited scalar
(`regulationMark`, `printedDenominator`, `artwork`, or `releaseDate`); use
`variants: null` to clear inherited variant definitions. Lists cannot be null.
There is no recursive merge of variants. The compiler materialises the result
so clients need no inheritance logic. Compiled printing metadata preserves
explicit nulls and empty lists, while absent unknown metadata stays absent.
Release dates are nullable core fields in the compiled API representation.

Put language/region-specific release dates in `release.yaml`; a set date is only
appropriate when it really applies to every release. Set files can also contain
`series`, `printedIdentifiers` and `externalIds`. Set keys stay stable when a
name is corrected. Do not invent official codes. Arbitrary `attributes` and
`printingAttributes` authoring fields are no longer accepted.

Add individual card files under
`catalogue/<game>/cards/<set-key>/<language>/<region>/`. No release configuration
file is required. If a language/region release has a different date, an optional
`release.yaml` in that directory can provide `releaseDate` for all its cards.
It can also provide `externalIds` patterns with `namespace`, `prefix` and `suffix`;
the compiler inserts the collector number between prefix and suffix. A card's
explicit namespace replaces the corresponding pattern. These are plain strings.

A new game needs `<game>/game.yaml` containing `name`. Series use
`<game>/series/<series-key>.yaml`; sets reference `<game>-series-<series-key>`.

## Shared identities for reprints

Most contributors never need to edit identities. When complete rules equivalence
has been reviewed, define `pokemon/identities/<key>.yaml`:

```yaml
localisations:
  en:
    name: Prism Seed
    pokemon:
      category: pokemon
      attacks: [{name: Rest, cost: []}]
  nl:
    name: Prism Seed
    pokemon:
      category: pokemon
      attacks: [{name: Rust, cost: []}]
```

This is a fictional example. Each printing references `identity: pokemon-card-<key>`
and must have a localisation matching its directory language. There is no
English fallback or automatic translation. Full localised gameplay lives on
the identity; a referencing printing cannot supply `pokemon` overrides. The
compiler emits one rules record per language, with IDs such as
`pokemon-card-<key>-nl`, linked by the generated `identityGroup` field. Ordinary
cards continue to get provisional identities per printing. Shared attack names
alone do not establish equivalence.

## Checks and licensing

Pokémon card fields are defined in
[`schemas/pokemon-card.schema.json`](schemas/pokemon-card.schema.json). Only
`name` is required, so incomplete cards remain valid. Unknown fields are errors;
HP must be a positive integer, Pokémon types use their TCG names, and explicit
collector numbers must be strings. An `identity` reference stores card attributes
on the shared identity instead of on the printing.

Run `pnpm install --frozen-lockfile` and `pnpm check` for schema validation and its
tests. The PR workflow runs tooling/tests and validates only changed catalogue files
before building the complete catalogue. Main validates every file.
VS Code users with the YAML extension also get the schema while editing, using
the repository's `.vscode/settings.json`. No per-card schema comment is required.
The [set schema](schemas/pokemon-set.schema.json) also validates every Pokémon set
and its shared printing fields. Games, series, identities, releases, products,
collections and artworks each have a schema and editor associations. Common
constraints live in `schemas/pokemon-common.schema.json`.
The compiler preserves scalar types: an unquoted numeric identifier or attack
damage is rejected rather than silently converted into a string.

CI checks syntax, duplicate keys, unknown fields, typed attributes, relationships
and duplicate printings, then verifies a reproducible JSON build. Parsing errors
include filenames and locations. Comments are supported; anchors, aliases, merges,
custom tags, includes, multiple documents and symlinks are rejected. Use two-space
indentation and quote numbers that are identifiers.

For local checks, clone the application, check out the commit in `builder-ref.txt`,
and run `CARDLATTICE_BUILDER=../cardlattice ./scripts/check.sh` in this repository.
Submitting a PR dedicates your original factual contribution under CC0-1.0.

## Canonical values

Category, energy types (including attack costs and weaknesses/resistances), stage,
subtypes, rarity, finishes, edition, ability kind and regulation mark use **case-sensitive
enums**. For example, use `Stage 1`, `Item` and `Common`; `Stage1`, `item`, `common`
and abbreviations such as `SIR` fail validation. `ex` and `EX` are deliberately
separate mechanics, not spelling aliases. The common schema's `$defs` lists every
supported value and supplies editor completions.

These are supported vocabularies, not a claim to cover every historical or
regional Pokémon mechanic. To introduce a legitimate new value, update the Rust
vocabulary in the application repository, its corresponding schema enum here,
and `builder-ref.txt` together. The build checks that the two vocabularies match;
this check reads the schema, not unchanged card files. Omit unknown optional
fields rather than using `Unknown`, `Other` or inventing a rarity.

Names, rules text, illustrator names and trainer affiliations remain text.
Product stamp identifiers remain slugs because releases are open-ended; they are
not rarity, stage or finish values. Regulation marks currently support A–J and
need an explicit vocabulary update when a later mark is introduced.

## Sets, products, collections and artwork

A printing's directory identifies its actual set and collector number. Never move
an SVP-numbered promo into an expansion just because it was distributed with that
expansion. Products record distribution; collections record an explicitly named
collector grouping. Neither changes the printing's set.

Define optional shared records in `catalogue/<game>/products/<key>.yaml`,
`collections/<key>.yaml` and `artworks/<key>.yaml`. Their generated IDs are
`<game>-product-<key>`, `<game>-collection-<key>` and `<game>-artwork-<key>`.
These are file references, not a hardcoded enum of every product or illustration.

```yaml
# products/example-box.yaml — illustrative only, not a real product
name: Example box
relatedSets: [pokemon-example]
```

```yaml
# collections/example-and-promos.yaml
name: Example expansion and associated promos
relatedSets: [pokemon-example]
description: Includes separately numbered promos distributed with this expansion.
```

```yaml
# artworks/example-seed.yaml
name: Example seed illustration
illustrators: [Example artist]
```

A printing may then contain:

```yaml
products: [pokemon-product-example-box]
collections: [pokemon-collection-example-and-promos]
artwork: pokemon-artwork-example-seed
```

Lists are optional, unique and bounded to 50 references. An explicit empty list
clears inherited membership. Sets and releases may supply shared membership only when
it applies to every printing. `relatedSets` provides context for a product or
collection; it does **not** automatically include every card in those sets.
The compiler rejects missing references, references to the wrong kind, and links
across games. Deleting a referenced definition requires updating its users in
the same change. Compilation checks the complete reference graph; PR schema
validation reads only changed card, set and definition files.

A set can record its printed identifiers without changing its canonical key:

```yaml
printedIdentifiers:
  - language: en
    region: US
    code: LAB
  - language: ja
    symbol: Laboratory flask
```

Each language/region scope is unique. Provide a code, a symbol description, or
both. `symbol` is a textual description, not a file path or an image URL.
Actual symbol images still require the existing image/rights publication process.

Shared artwork means the illustration is reused. It does not establish shared
rules, identical scans, or redistribution permission. Artwork records publish
metadata only; they do not publish images. Keep attacks inline, including their
costs, damage and exact effect text: the same attack name can differ even within
one expansion. Only verified complete rules equivalence justifies `identity`.

## Explicit physical variants

Use `finishes: [non-holo, reverse-holo]` for ordinary cards when that is all the
verified information. For edition/stamp/product combinations, use a small map:

```yaml
variants:
  first-edition-holo:
    finish: holo
    edition: first-edition
    stamps: [first-edition]
    products: [pokemon-product-example-box]
  unlimited-holo:
    finish: holo
    edition: unlimited
```

The map key identifies the variant; there is no repeated `id` property.
`finish` is required; edition, stamps and product membership are optional.
Supported editions are `first-edition` and `unlimited`; extend the vocabulary for
other documented editions. Never infer all combinations of editions and finishes.
If `finishes` is also supplied or inherited, it must match the variant finish
set. Remove or override incompatible inherited fields. Duplicate combinations,
unknown editions and missing/wrong-game product references fail compilation.
Variant product links are indexed for API product filtering. Artwork/image asset
publication continues to use the separate rights-controlled image pipeline.

Use Conventional Commits for every commit message and PR title, for example
`feat(data): add Korean cards` or `fix(schema): reject invalid finishes`.
Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
`revert`, `style`, `test`. Scopes and breaking-change `!` are optional.
Required PR checks rerun on title edits and validate every commit, including merges.
