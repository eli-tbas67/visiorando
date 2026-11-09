#!/bin/bash
# Double-cliquez sur ce fichier pour lancer le site en localhost (macOS).
cd "$(dirname "$0")" || exit 1
echo "Lancement de Visorando accessible…"
if command -v node >/dev/null 2>&1; then
  node server.mjs --open
else
  echo "Node.js n'est pas installé : utilisation de Python à la place."
  (sleep 1 && open "http://localhost:5173/") &
  python3 -m http.server 5173 --bind 127.0.0.1
fi
