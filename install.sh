#!/usr/bin/env bash
# Local development installer for Kanvas Studio on macOS & Linux (Hermes Desktop).
# Copies desktop/plugin.js, bundled icons/templates, and the kanvas-studio skill.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$(uname -s)" == "Darwin" ]]; then
  HERMES_LOCAL="${HERMES_HOME:-$HOME/.hermes}"
  HERMES_DATA="$HOME/Library/Application Support/Hermes/plugin-files/data/kanvas-studio"
else
  HERMES_LOCAL="${HERMES_HOME:-$HOME/.hermes}"
  HERMES_DATA="${XDG_CONFIG_HOME:-$HOME/.config}/Hermes/plugin-files/data/kanvas-studio"
fi

PLUGIN_DST="$HERMES_LOCAL/desktop-plugins/kanvas-studio"
SKILL_DST="$HERMES_LOCAL/skills/kanvas-studio"

mkdir -p "$PLUGIN_DST" "$SKILL_DST/references" "$HERMES_DATA"

cp "$ROOT/desktop/plugin.js" "$PLUGIN_DST/plugin.js"
for f in ikon.json template.json; do
  if [[ -f "$ROOT/app/dist/$f" ]]; then
    cp "$ROOT/app/dist/$f" "$HERMES_DATA/$f"
  fi
done
cp "$ROOT/skills/kanvas-studio/SKILL.md" "$SKILL_DST/SKILL.md"
cp "$ROOT/skills/kanvas-studio/kanvas_cek.py" "$SKILL_DST/kanvas_cek.py"
for ref in "$ROOT/skills/kanvas-studio/references/"*.md; do
  [[ -f "$ref" ]] && cp "$ref" "$SKILL_DST/references/$(basename "$ref")"
done

echo "Installed Kanvas Studio locally:"
echo "  plugin -> $PLUGIN_DST/plugin.js"
echo "  data   -> $HERMES_DATA"
echo "  skill  -> $SKILL_DST"
echo ""
echo "In Hermes Desktop: Capabilities -> Plugins -> enable 'Kanvas Studio' (or Ctrl/Cmd+K -> Reload desktop plugins)."
echo "Tip: run 'node \"$ROOT/bin/kanvas.js\" doctor' to verify Node.js and Chrome/Edge."
