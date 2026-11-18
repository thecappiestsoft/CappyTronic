#!/usr/bin/env bash
# CappyTronic – budowanie w Dockerze (Linux / macOS). Nie wymaga Node.js ani niczego poza Dockerem.
# Za każdym razem startuje czysty kontener node:20, buduje w nim wszystko i usuwa go po zakończeniu.
# Na komputerze zostaje tylko plik wynikowy w dist/ (żadnych node_modules/, vendor/, build/).
#
# Użycie: ./docker-build.sh <html|linux|win|mac> [opcje]
#   ./docker-build.sh linux            -> dist/CappyTronic-<wersja>-Linux-x64.tar.gz
#   ./docker-build.sh win              -> dist/CappyTronic-<wersja>-Windows-x64.zip
#   ./docker-build.sh mac              -> dist/CappyTronic-<wersja>-macOS-x64.zip (bez podpisu ad-hoc – patrz README)
#   ./docker-build.sh html [--quick]   -> dist/CappyTronic.html
#   --remove-image                     po zakończeniu usuń też obraz node:20 (następnym razem zostanie pobrany od nowa)
set -euo pipefail
IMAGE="node:20-bookworm"
cd "$(dirname "$0")/.."   # katalog główny repozytorium
ROOT="$(pwd)"

TARGET="${1:-}"
case "$TARGET" in html|linux|win|mac) shift ;; *) echo "Użycie: $0 <html|linux|win|mac> [opcje] [--remove-image]"; exit 1 ;; esac
REMOVE_IMAGE=0; ARGS=()
for a in "$@"; do if [ "$a" = "--remove-image" ]; then REMOVE_IMAGE=1; else ARGS+=("$a"); fi; done

command -v docker >/dev/null 2>&1 || { echo "Brak Dockera. Zainstaluj: https://docs.docker.com/get-docker/"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker nie działa (uruchom Docker Desktop / usługę docker)."; exit 1; }

mkdir -p dist
NAME="cappytronic-build-$$"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo "[cappytronic] budowanie '$TARGET' w kontenerze $IMAGE…"
# --platform linux/amd64: kompilatory są pobierane w wersji x64 (na Macu z Apple Silicon działa przez emulację)
MSYS_NO_PATHCONV=1 docker run --rm --name "$NAME" --platform linux/amd64 \
  -v "$ROOT:/src:ro" -v "$ROOT/dist:/out" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$IMAGE" bash -c 'sed "s/\r$//" /src/build-scripts/docker/build-in-docker.sh | bash -s -- "$@"' _ "$TARGET" "${ARGS[@]+"${ARGS[@]}"}"

if [ "$REMOVE_IMAGE" = 1 ]; then docker rmi "$IMAGE" >/dev/null && echo "[cappytronic] usunięto obraz $IMAGE"; fi
echo "[cappytronic] Gotowe – wynik w katalogu dist/"
