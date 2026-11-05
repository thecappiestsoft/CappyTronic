#!/usr/bin/env bash
# Dwuklik w Finderze uruchamia budowanie wersji dla macOS.
cd "$(dirname "$0")" && ./build-mac.sh; echo; read -n 1 -s -r -p "Naciśnij dowolny klawisz, aby zamknąć…"
