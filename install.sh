#!/usr/bin/env bash
set -euo pipefail
UUID=smart-dnd@keithvassallo.com
SRC="$(cd "$(dirname "$0")" && pwd)/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

glib-compile-schemas "$SRC/schemas"
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -r "$SRC" "$DEST"
echo "Installed to $DEST"
echo "Now log out/in (Wayland) or restart the shell, then: gnome-extensions enable $UUID"
