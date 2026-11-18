@echo off
rem CappyTronic - budowanie aplikacji dla Windows (x64) z kodu zrodlowego.
rem Wynik: dist\CappyTronic-<wersja>-Windows-x64.zip
setlocal
rem katalog glowny repozytorium (skrypt lezy w build-scripts\)
cd /d "%~dp0.."
call scripts\check-env.bat || goto :err
node scripts\build-all.mjs --target=win %*
if errorlevel 1 goto :err
echo.
echo Gotowe - wynik w katalogu dist\
pause
exit /b 0
:err
echo.
echo Budowanie nie powiodlo sie - szczegoly powyzej.
pause
exit /b 1
