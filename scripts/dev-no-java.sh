#!/usr/bin/env bash
#
# dev-no-java.sh — corre el launcher con el Java del sistema OCULTO, para probar la
# descarga automática de JRE de M4a (el fallback cuando detectJava no encuentra nada).
#
# NO toca tu sistema: usa bubblewrap (bwrap) para montar un tmpfs vacío sobre
# /usr/lib/jvm SOLO dentro de este proceso, corriendo como tu usuario normal (no root,
# así Electron no exige --no-sandbox). Al cerrar, todo vuelve solo. Nada se modifica en disco.
#
# Requiere: Linux con bubblewrap (`bwrap`). Solo para desarrollo.
#
# Uso:  ./scripts/dev-no-java.sh
#       -> abrí el launcher, dale JUGAR: debería mostrar la fase "JAVA %" y bajar el JRE
#          a userData/runtime la primera vez, después cachea.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v bwrap >/dev/null 2>&1; then
  echo "Falta bubblewrap. Instalá: sudo pacman -S bubblewrap" >&2
  exit 1
fi

# --dev-bind / /  : todo el sistema visible/escribible (no aislamos nada más)
# --tmpfs /usr/lib/jvm : oculta TODOS los JDK del sistema (y /usr/lib64/jvm, que es symlink)
# la red queda compartida (no --unshare-net) para poder bajar el JRE.
exec bwrap --dev-bind / / --tmpfs /usr/lib/jvm \
  --unsetenv JAVA_HOME \
  --setenv PACK_JAVA_PATH /nonexistent/java \
  bash -c '
    echo "[dev-no-java] java del sistema: $(command -v java || echo oculto ✅)"
    exec npm run dev
  '
