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

The initial workflow lives on the open PR until merge; the empty `main` branch
does not display it. PR and branch checks already run without waiting for merge.

Every PR runs explicit YAML and domain validation, compiler regression tests, and
two builds that must produce identical manifests. Checks reject broken references,
duplicate printing identities, unsupported attributes and unexpected files or
symlinks. No database, Cloudflare account or paid service is needed.

For local checks, use the application checkout pinned in `builder-ref.txt`:

```sh
CARDLATTICE_BUILDER=../cardlattice ./scripts/check.sh
CARDLATTICE_BUILDER=../cardlattice ./scripts/build.sh
```

The compiled JSON artifact includes a Git commit, checksum, byte size and measured
counts. The origin verifies and indexes it without rebuilding the catalogue.
A scheduled main-branch job publishes at most one immutable release per UTC day.
PR artifacts are previews. Deployment and optional R2 mirroring are operator setup.

## Catalogue

The initial batch contains 8 sets and 1,278 English printings. This is a partial
catalogue; rules, rarity, finishes and other languages remain unfilled. No artwork,
pricing data or third-party catalogue dumps are included.

The folder organisation takes inspiration from
[TCGdex's series/set/card files](https://github.com/tcgdex/cards-database/tree/master/data).
No TCGdex records were imported.

Original factual metadata: [CC0-1.0](LICENSE-DATA).
Build scripts and configuration: [MIT](LICENSE).
These licences do not cover publisher artwork or trademarks.
