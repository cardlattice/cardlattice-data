#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
builder="${CARDLATTICE_BUILDER:-$root/.builder}"
commit="$(git -C "$root" rev-parse HEAD)"
vocabulary="$(mktemp)"
trap 'rm -f "$vocabulary"' EXIT
cargo run --locked --quiet --manifest-path "$builder/Cargo.toml" -p cardlattice-api -- \
  pokemon-vocabulary > "$vocabulary"
node "$root/scripts/check-vocabulary.ts" "$vocabulary"
cargo run --locked --quiet --manifest-path "$builder/Cargo.toml" -p cardlattice-api -- \
  build-catalogue "$root/catalogue" "$root/dist" "$commit"
