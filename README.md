# Cardlattice data

Independently curated trading-card facts, reviewed through GitHub and compiled in
CI. The [application repository](https://github.com/cardlattice/cardlattice) contains
the Rust compiler, indexer, HTTP API and website. PostgreSQL is a serving index,
not the source of truth for these records.

## Catalogue

`catalogue/` contains a game file and one readable JSON file per set. Each file
contains records with explicit semantic identifiers, their metadata, provenance,
and optional external identifiers. Printing keys include the set, language,
region and collector number, for example `pokemon-mega-evolution-en-US-001`.
Card identities use `card-` followed by their original printing key until rules
review establishes equivalence. Same-name cards are not automatically merged.
UUIDs are not used. Changing a canonical key is a deletion plus a new record;
corrections to facts retain the key. Printing variants must use distinct semantic
keys when that data is added. Unknown finishes are not inferred.

The initial catalogue contains 1 game, 8 sets, 1,278 provisional card identities
and 1,278 printings. Names and collector numbers were independently transcribed
from official English checklists. This is not a complete catalogue: rules, rarity,
other languages, finishes and many other sets remain unreviewed. There are no
card images, prices or third-party catalogue dumps.

`provenance/pokemon/` retains the original reviewed source batches, URLs, retrieval
times, source digests and transcription corrections. These files are historical
source evidence; edit `catalogue/` to change the served catalogue. The recorded
review was automated at the operator's request, not expert human verification.

## Contribute

1. Fork this repository and create a branch.
2. Edit the relevant set file. Preserve the collector number as a string (including
   leading zeros), language, region and source evidence. Use original observations
   or permitted official references; do not copy another catalogue or API.
3. Submit a PR explaining the correction and its source. CI validates relationships,
   identifiers, duplicate printings, typed attributes and source metadata.
4. A maintainer reviews the PR. Merging does not automatically approve images.

Contributions dedicate only the contributor's original factual metadata under
CC0-1.0. Do not submit protected marketing prose, private information, credentials,
PDFs or scans to Git. Artwork is separate and is not covered by the data dedication.

## Build and publish

The compiler is pinned to an exact application commit in `builder-ref.txt`.
Updating it is a reviewed PR. The build makes no network or database calls; fetching
Rust dependencies and the pinned application checkout happens beforehand.

```sh
git clone https://github.com/cardlattice/cardlattice.git ../cardlattice
# Check out the commit from builder-ref.txt in that separate checkout.
CARDLATTICE_BUILDER=../cardlattice ./scripts/build.sh
```

CI builds on pull requests and pushes. It produces `manifest.json` and a
content-addressed `catalogue-<sha256>.json` artifact. The manifest contains the exact
source commit, byte count, checksum and measured counts. A second build must be
byte-identical. PR artifacts are previews, not approved production releases.

A scheduled workflow publishes at most one GitHub release per UTC day, from
`main`. Releases are named `catalogue-YYYY-MM-DD`; existing releases are never
overwritten. The same bytes can later be mirrored to R2. No Cloudflare account,
R2 credentials, database secrets or paid service is needed for CI.

Deployment downloads a trusted successful release and runs the application's
`index-catalogue <manifest.json> --apply` command. Checksums detect corruption;
they do not prove authorship, so do not index arbitrary PR artifacts. The indexer
validates again and atomically updates records, audit history and cache invalidation.
It skips unchanged records and retires removed managed records. Local edits that
conflict with a previous index fail for reconciliation instead of being overwritten.
The production deployment trigger and R2 mirroring are separate operator setup.

## Licences

Original factual metadata: [CC0-1.0](LICENSE-DATA).
Original build scripts and configuration: [MIT](LICENSE).
Neither licence grants rights to publisher artwork, trademarks or source documents.

The indexer also registers the verified artifact for the application's dataset
listing and downloads. The origin serves the original bytes; it does not build
another catalogue from PostgreSQL.
