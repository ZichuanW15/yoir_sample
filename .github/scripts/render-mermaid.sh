#!/usr/bin/env bash
#
# Render every Mermaid diagram in the repository to SVG + PNG.
#
# Sources picked up:
#   * .mmd / .mermaid files anywhere in the repo
#   * ```mermaid fenced blocks inside any .md file
#
# Usage: .github/scripts/render-mermaid.sh [output-dir]
# Exits non-zero if any diagram fails to render, so CI fails on a broken diagram.

set -euo pipefail

OUT_DIR="${1:-build/diagrams}"
PUPPETEER_CONFIG="${PUPPETEER_CONFIG:-.github/mermaid/puppeteer.json}"
MMDC="${MMDC:-mmdc}"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
SUMMARY="$OUT_DIR/summary.md"

# Each entry is "label|source.mmd|output-basename"
sources=()

# --- standalone diagram files ---------------------------------------------
while IFS= read -r -d '' f; do
  rel="${f#./}"
  sources+=("$rel|$f|$OUT_DIR/${rel%.*}")
done < <(find . \( -name .git -o -name node_modules -o -path "./${OUT_DIR#./}" \) -prune -o \
              \( -name '*.mmd' -o -name '*.mermaid' \) -print0 | sort -z)

# --- mermaid blocks embedded in markdown ----------------------------------
while IFS= read -r -d '' md; do
  rel="${md#./}"
  slug="$(printf '%s' "$rel" | tr '/.' '__')"
  awk -v dir="$WORK_DIR" -v slug="$slug" '
    !inblock && /^[[:space:]]*```[[:space:]]*mermaid[[:space:]]*$/ {
      n++; inblock = 1; f = sprintf("%s/%s.block%02d.mmd", dir, slug, n); next
    }
    inblock && /^[[:space:]]*```/ { inblock = 0; close(f); next }
    inblock { print > f }
  ' "$md"
  for blk in "$WORK_DIR/$slug".block*.mmd; do
    [ -e "$blk" ] || continue
    idx="${blk##*.block}"; idx="${idx%.mmd}"
    sources+=("$rel (mermaid block $idx)|$blk|$OUT_DIR/${rel%.md}.block$idx")
  done
done < <(find . \( -name .git -o -name node_modules -o -path "./${OUT_DIR#./}" \) -prune -o \
              -name '*.md' -print0 | sort -z)

# --- render ----------------------------------------------------------------
{
  echo "## Mermaid diagrams"
  echo
} > "$SUMMARY"

if [ ${#sources[@]} -eq 0 ]; then
  echo "No Mermaid diagrams found."
  echo "_No Mermaid diagrams found in this branch._" >> "$SUMMARY"
  exit 0
fi

failures=0

for entry in "${sources[@]}"; do
  label="${entry%%|*}"
  rest="${entry#*|}"
  src="${rest%%|*}"
  out="${rest#*|}"
  mkdir -p "$(dirname "$out")"

  if "$MMDC" --puppeteerConfigFile "$PUPPETEER_CONFIG" -i "$src" -o "$out.svg" -b transparent >"$out.log" 2>&1 \
     && "$MMDC" --puppeteerConfigFile "$PUPPETEER_CONFIG" -i "$src" -o "$out.png" -b white -s 2 >>"$out.log" 2>&1; then
    rm -f "$out.log"
    echo "ok   $label"
    {
      echo "<details open><summary><code>$label</code></summary>"
      echo
      echo '```mermaid'
      cat "$src"
      echo '```'
      echo
      echo "</details>"
      echo
    } >> "$SUMMARY"
  else
    failures=$((failures + 1))
    echo "FAIL $label"
    echo "::error file=${src#./},title=Mermaid render failed::$label could not be rendered"
    {
      echo "### :x: \`$label\`"
      echo
      echo '```'
      tail -n 20 "$out.log"
      echo '```'
      echo
    } >> "$SUMMARY"
  fi
done

echo
echo "Rendered $(( ${#sources[@]} - failures ))/${#sources[@]} diagram(s) into $OUT_DIR"

if [ "$failures" -gt 0 ]; then
  echo "$failures diagram(s) failed to render." >&2
  exit 1
fi
