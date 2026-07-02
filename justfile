uuid := "smart-dnd@keithvassallo.com"

# List available recipes
default:
    @just --list

# Install the extension into the local GNOME Shell extensions directory
install:
    ./install.sh

# Run Shexli static analysis (creates the venv on first run)
validate:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -x venv/bin/shexli ]; then
        python3 -m venv venv
        venv/bin/pip install -q -U pip shexli
        # tree-sitter 0.26 segfaults on Python 3.14; pin a stable parser.
        venv/bin/pip install -q "tree-sitter==0.24.0" "tree-sitter-javascript==0.23.1"
    fi
    venv/bin/shexli "$(pwd)/{{uuid}}"

# Build the extensions.gnome.org upload zip (runs validate first).
# Artefact goes to ~/Downloads by default; pass a directory to override.
package dest="": validate
    #!/usr/bin/env bash
    set -euo pipefail
    out="{{dest}}"
    [ -z "$out" ] && out="$HOME/Downloads"
    mkdir -p "$out"
    gnome-extensions pack "{{uuid}}" \
        --extra-source=lib \
        --extra-source=icons \
        --force \
        --out-dir="$out"
    echo "Packaged: $out/{{uuid}}.shell-extension.zip"
