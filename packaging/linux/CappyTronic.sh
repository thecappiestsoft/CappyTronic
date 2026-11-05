#!/usr/bin/env bash
# CappyTronic – uruchamianie na Linuksie (działa z dowolnego katalogu)
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ARGS=()
# Chromium nie pozwala uruchamiać się jako root z piaskownicą
[ "$(id -u)" = "0" ] && ARGS+=(--no-sandbox)
SB="$DIR/chrome-sandbox"
# Piaskownica Chromium wymaga albo przestrzeni nazw użytkownika, albo pliku chrome-sandbox z bitem SUID (właściciel root).
# Jeśli żadne nie jest dostępne (np. Ubuntu 24.04 bez instalacji), uruchamiamy bez piaskownicy systemowej.
if ! { [ -u "$SB" ] && [ "$(stat -c %u "$SB")" = "0" ]; }; then
  if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ]; then
    ARGS+=(--no-sandbox)
  fi
fi
exec "$DIR/cappytronic" "${ARGS[@]}" "$@"
