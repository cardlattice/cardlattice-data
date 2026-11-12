# Cardlattice data

Trading-card facts maintained through small GitHub contributions.
[The application](https://github.com/cardlattice/cardlattice) compiles these files
in CI, then indexes the resulting JSON catalogue for public API reads.
See the [catalogue dashboard](https://cardlattice.github.io/cardlattice-data/)
for current coverage.

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

A minimal card file, such as `pokemon/cards/mega-evolution/en/US/001.yaml`:

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
[Actions runs](https://github.com/cardlattice/cardlattice-data/actions)

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

## Licensing and attribution

The folder organisation takes inspiration from
[TCGdex's series/set/card files](https://github.com/tcgdex/cards-database/tree/master/data).
No TCGdex records were imported.

Original factual metadata: [CC0-1.0](LICENSE-DATA).
Build scripts and configuration: [MIT](LICENSE).
These licences do not cover publisher artwork or trademarks.

## Build and publish the dashboard

The status dashboard is generated from the same validated, compiled snapshot as
bulk downloads. It makes no requests to the API or third-party catalogues.

```sh
CARDLATTICE_BUILDER=/path/to/cardlattice ./scripts/build.sh
pnpm build:status
```

Open `site/index.html` to preview it locally. `site/coverage.json` contains the
aggregated measurements and source revision. HTML is pre-rendered; filtering,
pagination and theme selection are progressive enhancements. No artwork is
published by this dashboard.

CI builds the dashboard for every PR. Successful `main` builds deploy `site/`
using GitHub Pages Actions; PRs cannot deploy. Configure Settings → Pages →
Source as **GitHub Actions**. The expected project URL is
<https://cardlattice.github.io/cardlattice-data/>. Daily scheduled builds also
refresh the page. A failed build leaves the previous deployment intact; the
visible commit link identifies exactly which source revision is displayed.

Counts are printing records grouped by set, language and region, after compiler
inheritance. Finish coverage includes a nonempty `finishes` array or a named
variant with a recorded finish. Illustrator and rarity coverage measure nonempty
fields. These indicators do not establish exhaustive variants, image rights,
editorial review, uptime, or worldwide catalogue completeness. Printed
collector-number denominators are deliberately not treated as complete targets.
