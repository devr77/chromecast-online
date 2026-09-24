#!/usr/bin/env bash
# Regenerates the PNG icons and social image from their SVG sources.
# Requires rsvg-convert (macOS: `brew install librsvg`, Debian/Ubuntu: `apt install librsvg2-bin`).
set -euo pipefail
cd "$(dirname "$0")/.."

rsvg-convert -w 48  -h 48  favicon.svg -o favicon-48.png
rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 favicon.svg -o assets/img/icon-192.png
rsvg-convert -w 512 -h 512 favicon.svg -o assets/img/icon-512.png
rsvg-convert -w 1200 -h 630 src/images/og-image.svg -o og-image.png

echo "Images rebuilt."
