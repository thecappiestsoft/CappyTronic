#!/usr/bin/env bash
# Instalacja CappyTronic w /opt/cappytronic + skrót w menu aplikacji. Uruchom: sudo ./install.sh
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
[ "$(id -u)" = "0" ] || { echo "Uruchom z sudo: sudo ./install.sh"; exit 1; }
rm -rf /opt/cappytronic && mkdir -p /opt/cappytronic && cp -a "$SRC/." /opt/cappytronic/
chown root:root /opt/cappytronic/chrome-sandbox && chmod 4755 /opt/cappytronic/chrome-sandbox
chmod -R a+rX /opt/cappytronic
for d in toolchain armgcc wasi; do find /opt/cappytronic/resources/$d -type f \( -path '*/bin/*' -o -path '*/libexec/*' \) -exec chmod a+x {} + 2>/dev/null || true; done
ln -sf /opt/cappytronic/CappyTronic.sh /usr/local/bin/cappytronic
install -Dm644 /opt/cappytronic/cappytronic.png /usr/share/icons/hicolor/512x512/apps/cappytronic.png
install -Dm644 /opt/cappytronic/cappytronic.desktop /usr/share/applications/cappytronic.desktop
sed -i 's#^Exec=.*#Exec=/opt/cappytronic/CappyTronic.sh %F#; s#^Icon=.*#Icon=cappytronic#' /usr/share/applications/cappytronic.desktop
command -v update-desktop-database >/dev/null && update-desktop-database -q /usr/share/applications || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q /usr/share/icons/hicolor || true
# wgrywanie programów przez USB wymaga dostępu do portów szeregowych (grupa dialout)
if [ -n "$SUDO_USER" ] && getent group dialout >/dev/null; then usermod -aG dialout "$SUDO_USER" && echo "Dodano użytkownika $SUDO_USER do grupy dialout (wgrywanie przez USB) – wyloguj się i zaloguj ponownie."; fi
echo "Zainstalowano. Uruchom z menu aplikacji albo poleceniem: cappytronic"
