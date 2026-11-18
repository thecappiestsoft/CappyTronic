@echo off
rem CappyTronic - budowanie pojedynczego pliku dist\CappyTronic.html (dziala offline w przegladarce).
rem Szybko, bez kompilatorow (bez kompilacji przykladow): build-html.bat --quick
setlocal
rem katalog glowny repozytorium (skrypt lezy w build-scripts\)
cd /d "%~dp0.."
call scripts\check-env.bat || goto :err
if "%~1"=="--quick" (node scripts\build-html.mjs) else (node scripts\build-all.mjs --target=html %*)
if errorlevel 1 goto :err
echo.
echo Gotowe - dist\CappyTronic.html
pause
exit /b 0
:err
echo.
echo Budowanie nie powiodlo sie - szczegoly powyzej.
pause
exit /b 1
