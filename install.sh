#!/usr/bin/env bash
set -euo pipefail
UUID=smart-dnd@keithvassallo.com
SRC="$(cd "$(dirname "$0")" && pwd)/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -r "$SRC" "$DEST"
rm -f "$DEST/schemas/gschemas.compiled"
glib-compile-schemas "$DEST/schemas"
echo "Installed to $DEST"
echo "Now log out/in (Wayland) or restart the shell, then: gnome-extensions enable $UUID"
