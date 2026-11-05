#!/usr/bin/env bash
# CappyTronic – budowanie aplikacji dla Linuksa (x64) z kodu źródłowego.
# Wynik: dist/CappyTronic-<wersja>-Linux-x64.tar.gz   (dodatkowe opcje przekazywane do scripts/build-all.mjs)
set -euo pipefail
cd "$(dirname "$0")"
source ./scripts/check-env.sh
node scripts/build-all.mjs --target=linux "$@"
