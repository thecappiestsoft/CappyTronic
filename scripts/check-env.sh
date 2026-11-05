# Sprawdzenie środowiska i instalacja zależności npm (wywoływane przez build-*.sh)
if ! command -v node >/dev/null 2>&1; then echo "Brak Node.js. Zainstaluj Node.js 20 lub nowszy: https://nodejs.org"; exit 1; fi
if ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)'; then echo "Wymagany Node.js 20 lub nowszy (masz $(node -v))."; exit 1; fi
command -v tar >/dev/null 2>&1 || { echo "Brak polecenia tar."; exit 1; }
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "[cappytronic] instalowanie zależności npm…"
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
fi
