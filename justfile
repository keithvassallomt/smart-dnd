uuid := "smart-dnd@keithvassallo.com"
repo := "keithvassallomt/smart-dnd"
# extensions.gnome.org page for the release badge; set once the extension is
# published (e.g. https://extensions.gnome.org/extension/NNNN/smart-dnd/).
ego_url := ""
ego_badge := "https://github.com/user-attachments/assets/a9aa1a44-8d52-465b-980b-6f8e6c811fee"

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

# Tag vX.Y.Z and publish a GitHub release. Notes are built from the matching
# CHANGELOG.md section. `kind` is the leading sentence (default "Feature release").
release version kind="Feature release":
    #!/usr/bin/env bash
    set -euo pipefail
    tag="v{{version}}"

    [ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean." >&2; exit 1; }
    [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "Not on main." >&2; exit 1; }
    git rev-parse -q --verify "refs/tags/$tag" >/dev/null && { echo "Tag $tag already exists." >&2; exit 1; } || true
    grep -q "^## \[{{version}}\]" CHANGELOG.md || { echo "No CHANGELOG.md entry for {{version}}." >&2; exit 1; }

    versions=$(python3 -c "import json;print(' and '.join(json.load(open('{{uuid}}/metadata.json'))['shell-version']))")
    section=$(awk -v v="{{version}}" '
        $0 ~ "^## \\[" v "\\]" {b=1; next}
        b && (/^## / || /^\[[^]]+\]: /) {exit}
        b {print}' CHANGELOG.md | sed 's/^### /## /' | sed '/./,$!d' | tac | sed '/./,$!d' | tac)
    prev=$(git tag --sort=-v:refname | head -n1 || true)

    notes=$(mktemp)
    {
        echo "{{kind}}. Supports GNOME Shell $versions on Wayland."
        echo
        if [ -n "{{ego_url}}" ]; then
            echo "<a href=\"{{ego_url}}\"><img width=\"300\" height=\"139\" alt=\"get-it-on-ego\" src=\"{{ego_badge}}\" /></a>"
            echo
        fi
        echo "$section"
        if [ -n "$prev" ]; then
            echo
            echo "**Full changelog:** https://github.com/{{repo}}/compare/$prev...$tag"
        fi
    } > "$notes"

    echo "--- release notes for $tag ---"; cat "$notes"; echo "---"
    git push origin main
    git tag -a "$tag" -m "Smart DND $tag"
    git push origin "$tag"
    gh release create "$tag" --repo "{{repo}}" --title "$tag" --notes-file "$notes"
    rm -f "$notes"
    echo "Published $tag"
