#!/usr/bin/env bash
# CappyTronic – budowanie aplikacji dla macOS (Intel albo Apple Silicon – zgodnie z komputerem) z kodu źródłowego.
# Wynik: dist/CappyTronic-<wersja>-macOS-<arch>.zip.   Inna architektura: ./build-mac.sh --arch=x64 (albo arm64)
set -euo pipefail
cd "$(dirname "$0")/.."   # katalog główny repozytorium
source ./scripts/check-env.sh
node scripts/build-all.mjs --target=mac "$@"
