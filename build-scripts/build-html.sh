#!/usr/bin/env bash
# CappyTronic – budowanie pojedynczego pliku dist/CappyTronic.html (działa offline w przeglądarce).
# Pełne budowanie kompiluje też przykłady (pobiera kompilatory). Szybko, bez kompilatorów: ./build-html.sh --quick
set -euo pipefail
cd "$(dirname "$0")"
source ./scripts/check-env.sh
if [ "${1:-}" = "--quick" ]; then node scripts/build-html.mjs; else node scripts/build-all.mjs --target=html "$@"; fi
