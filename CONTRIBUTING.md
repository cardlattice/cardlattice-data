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
- `regulationMark`, `printedTotal`, `illustrators`: printed details. The denominator
  is separate from the number of cards catalogued; secret cards may exceed it.
- `attributes`: game-specific card fields for other games. Do not combine this
  with `pokemon`. Pokémon still uses its typed validator.
- `printingAttributes`: reserved; use the named printing fields above for Pokémon.
- `externalIds`: optional namespace/value identifiers from other systems.
- `identity`: an existing shared card identity, when rules equivalence has been
  established. Otherwise omit it and let the compiler generate one.

Do not add `id`, `gameId`, `setId` or `identityScope`; the compiler generates them.
A name correction must not rename the file or change its canonical key. Regions
use their explicit code, or `global` when there is no region value. Keep language
tags in the directory, e.g. `en`, `ja` or `pt-BR`.

Attacks retain printed order. `cost` is an array of energy type names, including
repeated entries; `[]` means a free attack. Quote `damage`, including plain numbers,
so `"20"`, `"30+"` and `"20×"` are strings. Omit damage for effect-only attacks.
Use `text` for the effect. An ability has `name`, `text`, and `kind` (`Ability`,
`Pokémon Power`, `Poké-Power`, or `Poké-Body`). Energy symbols in text use names;
repeated standalone symbols can be written `{Colorless}{Colorless}`.

Weaknesses/resistances are lists such as `[{type: Fire, value: "×2"}]`.
`retreatCost` counts Colorless energy symbols. `subtypes` includes printed mechanics
such as `ex` or Trainer categories such as `Item`. `rules` contains ordered rule
paragraphs. Trainer/Energy records cannot carry Pokémon HP, attacks or retreat costs.

An omitted list is unknown; an empty list confirms none. Do not fill missing facts
by inference from the name, another printing or the Pokémon species.

## Add a set or release

Add `catalogue/<game>/sets/<set-key>.yaml`:

```yaml
name: "Laboratory"
releaseDate: "2026-01-01"
defaults:
  stamps: [laboratory-anniversary]
  regulationMark: J
  printedTotal: 128
```

Set `defaults` may contain `finishes`, `stamps`, `regulationMark`, `printedTotal`
and `illustrators`. Use defaults only when they apply to every printing in the
set. A card's explicit value replaces its default; `stamps: []` clears inherited
stamps. The compiler materialises these values on each published printing, so API
consumers need no inheritance logic. Defaults do not create a cross-product of
finishes and stamps: document only combinations that actually exist. Special
release/product membership and variant-specific images are not implemented yet.

Set files may also include `language`, `region`, a `series` identifier,
`attributes` and `externalIds`. Set keys are stable: correcting a displayed name
does not rename the file. Use a known set code when available; existing keys use
readable names. Do not invent official codes.

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

Most contributors never need to edit identities. When two printings share the
same rules, define a shared identity in `<game>/identities/<key>.yaml` with `name`
and `attributes`. Reference it as `<game>-card-<key>` from each printing's
`identity` field. Put card attributes on that identity, not each printing.
Otherwise, provisional identities are generated per printing.

## Checks and licensing

Pokémon card fields are defined in
[`schemas/pokemon-card.schema.json`](schemas/pokemon-card.schema.json). Only
`name` is required, so incomplete cards remain valid. Unknown fields are errors;
HP must be a positive integer, Pokémon types use their TCG names, and explicit
collector numbers must be strings. An `identity` reference stores card attributes
on the shared identity instead of on the printing.

Run `pnpm install --frozen-lockfile` and `pnpm check` for schema validation and its
tests. The PR workflow runs tooling/tests and validates only changed card/set files
before building the complete catalogue. Main validates every file.
VS Code users with the YAML extension also get the schema while editing, using
the repository's `.vscode/settings.json`. No per-card schema comment is required.
The [set schema](schemas/pokemon-set.schema.json) also validates every Pokémon set
and its defaults. Game, identity and optional release files retain Rust validation.
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
subtypes, rarity, finishes, ability kind and regulation mark use **case-sensitive
enums**. For example, use `Stage 1`, `Item` and `Common`; `Stage1`, `item`, `common`
and abbreviations such as `SIR` fail validation. `ex` and `EX` are deliberately
separate mechanics, not spelling aliases. The schema's `$defs` lists every
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
