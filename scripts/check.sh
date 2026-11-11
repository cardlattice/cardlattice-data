#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
builder="${CARDLATTICE_BUILDER:-$root/.builder}"
cargo run --locked --quiet --manifest-path "$builder/Cargo.toml" -p cardlattice-api -- \
  validate-catalogue "$root/catalogue"
cargo test --locked --manifest-path "$builder/Cargo.toml" -p cardlattice-api \
  --test catalogue_bundle source_tree
cargo test --locked --manifest-path "$builder/Cargo.toml" -p cardlattice-api \
  --test catalogue_bundle reproducible_build
