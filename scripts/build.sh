#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
builder="${CARDLATTICE_BUILDER:-$root/.builder}"
commit="$(git -C "$root" rev-parse HEAD)"
cargo run --locked --quiet --manifest-path "$builder/Cargo.toml" -p cardlattice-api -- \
  build-catalogue "$root/catalogue" "$root/dist" "$commit"
