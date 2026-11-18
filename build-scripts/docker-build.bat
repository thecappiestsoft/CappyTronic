@echo off
rem CappyTronic - budowanie w Dockerze (Windows, Docker Desktop). Nie wymaga Node.js ani niczego poza Dockerem.
rem Za kazdym razem startuje czysty kontener node:20, buduje w nim wszystko i usuwa go po zakonczeniu.
rem Na komputerze zostaje tylko plik wynikowy w dist\ (zadnych node_modules\, vendor\, build\).
rem
rem Uzycie: docker-build.bat [html^|linux^|win^|mac] [opcje] [--remove-image]
rem   docker-build.bat win            -> dist\CappyTronic-<wersja>-Windows-x64.zip
rem   docker-build.bat linux          -> dist\CappyTronic-<wersja>-Linux-x64.tar.gz
rem   docker-build.bat html --quick   -> dist\CappyTronic.html (bez kompilacji przykladow)
rem   --remove-image                  po zakonczeniu usun tez obraz node:20
rem Dwuklik bez parametrow - pyta o cel.
setlocal EnableDelayedExpansion
set "IMAGE=node:20-bookworm"
rem katalog glowny repozytorium (skrypt lezy w build-scripts\)
cd /d "%~dp0.."
set "ROOT=%CD%"

set "TARGET=%~1"
if "%TARGET%"=="" (
  echo Co zbudowac?
  echo   1 - Windows ^(zip^)
  echo   2 - Linux ^(tar.gz^)
  echo   3 - macOS ^(zip, bez podpisu^)
  echo   4 - jeden plik HTML
  choice /c 1234 /n /m "Wybierz [1-4]: "
  if errorlevel 4 (set "TARGET=html") else if errorlevel 3 (set "TARGET=mac") else if errorlevel 2 (set "TARGET=linux") else (set "TARGET=win")
) else (
  shift
)
if not "%TARGET%"=="html" if not "%TARGET%"=="linux" if not "%TARGET%"=="win" if not "%TARGET%"=="mac" (
  echo Nieznany cel: %TARGET% ^(html, linux, win, mac^)
  goto :err
)

set "REMOVE_IMAGE=0"
set "ARGS="
:args
if "%~1"=="" goto :argsdone
if "%~1"=="--remove-image" (set "REMOVE_IMAGE=1") else (set "ARGS=!ARGS! %1")
shift
goto :args
:argsdone

where docker >nul 2>nul || (echo Brak Dockera. Zainstaluj Docker Desktop: https://docs.docker.com/desktop/ & goto :err)
docker info >nul 2>nul || (echo Docker nie dziala - uruchom Docker Desktop. & goto :err)

if not exist dist mkdir dist
set "NAME=cappytronic-build-%RANDOM%%RANDOM%"
echo [cappytronic] budowanie '%TARGET%' w kontenerze %IMAGE%...
docker run --rm --name %NAME% --platform linux/amd64 -v "%ROOT%:/src:ro" -v "%ROOT%\dist:/out" %IMAGE% bash -c "sed 's/\r$//' /src/build-scripts/docker/build-in-docker.sh | bash -s -- \"$@\"" _ %TARGET% %ARGS%
set "RC=%ERRORLEVEL%"
docker rm -f %NAME% >nul 2>nul
if not "%RC%"=="0" goto :err

if "%REMOVE_IMAGE%"=="1" (docker rmi %IMAGE% >nul && echo [cappytronic] usunieto obraz %IMAGE%)
echo.
echo Gotowe - wynik w katalogu dist\
pause
exit /b 0
:err
echo.
echo Budowanie nie powiodlo sie - szczegoly powyzej.
pause
exit /b 1
