#!/usr/bin/env bash
set -e
[ "$(id -u)" = "0" ] || { echo "Uruchom z sudo: sudo ./uninstall.sh"; exit 1; }
rm -rf /opt/cappytronic /usr/local/bin/cappytronic /usr/share/applications/cappytronic.desktop /usr/share/icons/hicolor/512x512/apps/cappytronic.png
echo "Odinstalowano CappyTronic."
