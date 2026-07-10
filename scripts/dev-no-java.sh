#!/usr/bin/env bash
#
# dev-no-java.sh — corre el launcher con el Java del sistema OCULTO, para probar la
# descarga automática de JRE de M4a (el fallback cuando detectJava no encuentra nada).
#
# NO toca tu sistema: usa un mount namespace de usuario (efímero) para montar un tmpfs
# vacío sobre /usr/lib/jvm — dentro de ese proceso `java` queda colgado y las rutas
# hardcodeadas desaparecen. Al cerrar, todo vuelve solo. Nada se modifica en disco.
#
# Requiere: Linux con user namespaces (Arch los trae). Solo para desarrollo.
#
# Uso:  ./scripts/dev-no-java.sh
#       -> abrí el launcher, dale JUGAR: debería mostrar la fase "JAVA %" y bajar el JRE
#          a userData/runtime la primera vez, después cachea.
set -euo pipefail
cd "$(dirname "$0")/.."

exec unshare -rm --map-root-user bash -c '
  # Ocultar todos los JVM del sistema solo para este árbol de procesos.
  mount -t tmpfs none /usr/lib/jvm
  # Cerrar los otros caminos de detectJava.
  export JAVA_HOME=
  export PACK_JAVA_PATH=/nonexistent/java
  echo "[dev-no-java] Java del sistema oculto en este namespace:"
  command -v java >/dev/null && (java -version >/dev/null 2>&1 && echo "  OJO: java todavia responde" || echo "  java NO ejecutable -> OK, se usara el JRE gestionado")
  exec npm run dev
'
