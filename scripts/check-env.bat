@echo off
rem Sprawdzenie srodowiska i instalacja zaleznosci npm (wywolywane przez build-*.bat)
where node >nul 2>nul || (echo Brak Node.js. Zainstaluj Node.js 20 lub nowszy: https://nodejs.org & exit /b 1)
node -e "process.exit(+process.versions.node.split(\".\")[0] >= 20 ? 0 : 1)" || (echo Wymagany Node.js 20 lub nowszy. & exit /b 1)
where tar >nul 2>nul || (echo Brak polecenia tar - wymagany Windows 10 lub nowszy. & exit /b 1)
if exist node_modules goto :eof
echo [cappytronic] instalowanie zaleznosci npm...
if exist package-lock.json (call npm ci --no-audit --no-fund) else (call npm install --no-audit --no-fund)
if errorlevel 1 exit /b 1
