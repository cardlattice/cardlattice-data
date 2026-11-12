# Cardlattice data

Trading-card facts maintained through small GitHub contributions.
[The application](https://github.com/cardlattice/cardlattice) compiles these files
in CI, then indexes the resulting JSON catalogue for public API reads.

**To correct a card, edit its YAML file and open a pull request.** No database
knowledge, generated identifiers, citations or source-evidence files are required.
Git history records the changes.

## Find a card

```text
catalogue/
  pokemon/
    game.yaml
    sets/
      mega-evolution.yaml
    cards/
      mega-evolution/
        en/
          US/
            001.yaml
            002.yaml
```

`pokemon/cards/mega-evolution/en/US/001.yaml` currently contains:

```yaml
name: "Bulbasaur"
```

The path supplies the game, set, language, region and collector number. The set
file supplies its release date. Each card file represents one printing; reprints
in another set have their own files. Internal provisional card identities are
generated automatically. Existing semantic keys remain unchanged by this layout.

## Contribute

1. Browse to the card file and use GitHub's pencil button, or edit a local clone.
2. Make the correction. Preserve leading zeros in filenames and quote explicit
   collector numbers, e.g. `collectorNumber: "001"`.
3. Open a PR describing what changed. CI reports invalid files, and a maintainer
   reviews the correction before merging.

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding cards, sets and shared identities.
YAML comments are welcome. Unknown fields, duplicate keys, anchors, aliases and
merge keys fail validation. Data files cannot execute code.

## Validation and CI

[Catalogue workflow](.github/workflows/catalogue.yml) ·
[Actions runs](https://github.com/cardlattice/cardlattice-data/actions) ·
[Initial PR and checks](https://github.com/cardlattice/cardlattice-data/pull/1)

The workflow runs on pull requests and main pushes. A dedicated **Validate Pokémon
YAML schema** job checks only added/modified card and set YAML files in a PR against
[the card schema](schemas/pokemon-card.schema.json) and
[set schema](schemas/pokemon-set.schema.json) before the Rust build runs. Renames validate the new path; deleted files are not
opened. The comparison uses the PR base commit and fails closed if it cannot be
resolved. Main pushes and scheduled releases validate the whole catalogue.

Every PR runs validator regression tests and two complete preview builds that
must produce identical manifests. Compilation still checks whole-catalogue
references, so deleting a referenced set cannot produce a broken artifact. Main
runs the additional standalone Rust data validation and compiler regression tests. Checks reject broken references,
duplicate printing identities, unsupported attributes and unexpected files or
symlinks. No database, Cloudflare account or paid service is needed.

For local checks, use the application checkout pinned in `builder-ref.txt`:

```sh
pnpm install --frozen-lockfile
pnpm check
CARDLATTICE_BUILDER=../cardlattice ./scripts/check.sh
CARDLATTICE_BUILDER=../cardlattice ./scripts/build.sh
```

`pnpm check` runs Oxfmt, Oxlint, TypeScript, schema regression tests and card/set
validation. Node 24 and pnpm 12.18 are used in CI. The existing Rust check still
validates game/set/release files, references and catalogue-wide constraints.

The compiled JSON artifact includes a Git commit, checksum, byte size and measured
counts. The origin verifies and indexes it without rebuilding the catalogue.
A scheduled main-branch job publishes at most one immutable release per UTC day.
PR artifacts are previews. Deployment and optional R2 mirroring are operator setup.

## Catalogue

The catalogue contains 9 sets and 1,485 English printings. All 158 existing
numbered 30th Celebration cards now include rarity, confirmed holo finish, printed
rules and applicable Pokémon stats, attacks, abilities, weaknesses, resistances
and retreat costs. Shared anniversary stamp, regulation mark and denominator are
set defaults.

Scarlet & Violet—151 includes all 207 numbered entries (001–207), with names,
rarities, categories, applicable printed stats, evolution stages, attacks and
costs, abilities, weaknesses, resistances, retreat costs and rules. These were
transcribed from the publisher's card images; normal, holo and reverse-holo
availability was checked against its checklist and printed player guide.
All cards inherit the printed denominator of 165. Cards 001–206 have regulation
mark G; Basic Psychic Energy 207 has no printed regulation mark. The Psychic
symbol in its name is written as text. Unnumbered Basic Energy cards, product promos,
metal cards and stamped/other product variants are not covered by this count.
The 151 Booster Bundle is linked to the set as product context, without asserting
that a particular card is guaranteed in a bundle. Other sets remain name-only.

This is still a partial catalogue. The separate 30th Celebration Classic
Collection, Basic Energy section and product promos are not included. Illustrator
credits, Pokédex numbers, flavour text, detailed foil patterns and other languages
remain unfilled. No artwork, pricing data or third-party catalogue dumps are included.

The folder organisation takes inspiration from
[TCGdex's series/set/card files](https://github.com/tcgdex/cards-database/tree/master/data).
No TCGdex records were imported.

Original factual metadata: [CC0-1.0](LICENSE-DATA).
Build scripts and configuration: [MIT](LICENSE).
These licences do not cover publisher artwork or trademarks.
