#!/usr/bin/env bash
# CappyTronic – budowanie WEWNĄTRZ kontenera Dockera (node:20). Uruchamiane przez docker-build.sh / docker-build.bat,
# nie wywołuj ręcznie. Kod źródłowy jest zamontowany tylko do odczytu w /src, wynik trafia do /out (= dist/ na komputerze).
# Użycie: build-in-docker.sh <html|linux|win|mac> [dodatkowe opcje dla scripts/build-all.mjs, np. --quick dla html]
set -euo pipefail
TARGET="${1:-html}"; shift || true
log() { echo "[cappytronic/docker] $*"; }

log "Node $(node -v), npm $(npm -v), cel: $TARGET"

# 1) programy systemowe potrzebne do budowania (zip – archiwa .zip dla Windows/macOS, wine – ikona i metadane .exe)
PKGS="zip bzip2 xz-utils"
[ "$TARGET" = "win" ] && PKGS="$PKGS wine wine64"
log "instalowanie pakietów: $PKGS"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends $PKGS >/dev/null
if [ "$TARGET" = "win" ]; then export WINEDEBUG=-all WINEPREFIX=/tmp/wine; wineboot --init >/dev/null 2>&1 || true; fi

# 2) czysta kopia kodu źródłowego (bez node_modules, vendor, build, dist z komputera)
mkdir -p /work
tar -C /src --exclude=./node_modules --exclude=./vendor --exclude=./build --exclude=./dist --exclude=./.git -cf - . | tar -C /work -xf -
# końce linii CRLF (checkout w Windows) psułyby skrypty .sh
find /work -name '*.sh' -exec sed -i 's/\r$//' {} +
cd /work

# 3) zależności npm dokładnie wg package-lock.json
log "npm ci"
npm ci --no-audit --no-fund

# 4) budowanie
if [ "$TARGET" = "html" ] && [ "${1:-}" = "--quick" ]; then
  node scripts/build-html.mjs
else
  node scripts/build-all.mjs --target="$TARGET" "$@"
fi

# 5) do /out kopiowany jest tylko plik wynikowy
case "$TARGET" in
  html)  RESULT=(dist/CappyTronic.html) ;;
  linux) RESULT=(dist/CappyTronic-*-Linux-*.tar.gz) ;;
  win)   RESULT=(dist/CappyTronic-*-Windows-*.zip) ;;
  mac)   RESULT=(dist/CappyTronic-*-macOS-*.zip) ;;
esac
[ -e "${RESULT[0]}" ] || { log "BŁĄD: nie znaleziono pliku wynikowego"; exit 1; }
for f in "${RESULT[@]}"; do
  cp -f "$f" /out/
  # na Linuksie plik ma należeć do użytkownika, a nie do roota
  if [ -n "${HOST_UID:-}" ]; then chown "$HOST_UID:${HOST_GID:-$HOST_UID}" "/out/$(basename "$f")"; fi
  log "WYNIK: dist/$(basename "$f")"
done
