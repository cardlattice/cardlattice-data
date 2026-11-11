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
pokemon:
  category: pokemon
  hp: 70
  types: [Lightning]
  stage: Basic
```

- `collectorNumber`: override the filename when the printed number contains a
  character unsuitable for filenames, e.g. `"A/001"`. Keep the filename stable.
- `releaseDate`: override the release or set date, in quoted `"YYYY-MM-DD"` form.
- `pokemon`: `category`, `hp`, `types` and `stage`. Leave unknown facts absent.
  The current adapter does not yet model attacks, abilities or image publication.
- `attributes`: game-specific card fields for other games. Do not combine this
  with `pokemon`. Pokémon still uses its typed validator.
- `printingAttributes`: printing-specific facts, separate from card rules.
- `externalIds`: optional namespace/value identifiers from other systems.
- `identity`: an existing shared card identity, when rules equivalence has been
  established. Otherwise omit it and let the compiler generate one.

Do not add `id`, `gameId`, `setId` or `identityScope`; the compiler generates them.
A name correction must not rename the file or change its canonical key. Regions
use their explicit code, or `global` when there is no region value. Keep language
tags in the directory, e.g. `en`, `ja` or `pt-BR`.

## Add a set or release

Add `catalogue/<game>/sets/<set-key>.yaml`:

```yaml
name: "Laboratory"
releaseDate: "2026-01-01"
```

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

CI checks syntax, duplicate keys, unknown fields, typed attributes, relationships
and duplicate printings, then verifies a reproducible JSON build. Parsing errors
include filenames and locations. Comments are supported; anchors, aliases, merges,
custom tags, includes, multiple documents and symlinks are rejected. Use two-space
indentation and quote numbers that are identifiers.

For local checks, clone the application, check out the commit in `builder-ref.txt`,
and run `CARDLATTICE_BUILDER=../cardlattice ./scripts/check.sh` in this repository.
Submitting a PR dedicates your original factual contribution under CC0-1.0.
