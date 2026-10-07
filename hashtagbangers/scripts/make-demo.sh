#!/bin/sh
# Génère demo/ : version statique sans compilation (GitHub Pages), Three.js et GSAP inclus.
# Usage : sh scripts/make-demo.sh <dossier three/build> <dossier gsap/esm>
# (ou, après `npm install` : node_modules/three/build et node_modules/gsap/esm)
set -e
THREE=${1:-node_modules/three/build}
GSAP=${2:-node_modules/gsap/esm}
cd "$(dirname "$0")/.."
rm -rf demo && mkdir -p demo/vendor/three demo/vendor/gsap
cp -r src demo/src
cp public/logo.png demo/logo.png
cp "$THREE/three.module.js" "$THREE/three.core.js" demo/vendor/three/
cp "$GSAP"/*.js demo/vendor/gsap/ && cp -r "$GSAP/utils" demo/vendor/gsap/ 2>/dev/null || true
sed -e 's#href="/logo.png"#href="./logo.png"#' -e 's#src="/logo.png"#src="./logo.png"#g' \
    -e 's#href="/src/style.css"#href="./src/style.css"#' \
    -e 's#<script type="module" src="/src/main.js"></script>#<script type="importmap">{"imports":{"three":"./vendor/three/three.module.js","gsap":"./vendor/gsap/index.js"}}</script>\n<script type="module" src="./src/main.js"></script>#' \
    index.html > demo/index.html
echo "demo/ prêt"
