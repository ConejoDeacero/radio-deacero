#!/usr/bin/env bash
# ============================================================================
#  DEACERO Play Lite — Instalador de arranque automático (Raspberry Pi)
# ============================================================================
#  Genera la entrada de autostart con la RUTA REAL de esta carpeta detectada
#  automáticamente (evita el error "entrada de escritorio no válida" por una
#  ruta de Exec incorrecta). Da permisos de ejecución a los scripts y valida
#  el .desktop resultante.
#
#  USO (dentro de la Raspberry, desde esta carpeta o con ruta completa):
#     ./install-autostart.sh [URL]
#     (URL por defecto: http://localhost:8000 ; añade /?mode=video para arrancar en video)
# ============================================================================
set -eu

# --- Carpeta REAL donde vive este script (aunque lo llamen desde otro sitio)
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
URL="${1:-http://localhost:8000}"
AUTOSTART_DIR="$HOME/.config/autostart"
TARGET="$AUTOSTART_DIR/play-lite-kiosk.desktop"
OLD="$AUTOSTART_DIR/deacero-kiosk.desktop"   # kiosco anterior (apuntaba a gestweb)

# --- Permisos de ejecución a los scripts
chmod +x "$DIR/start-kiosk.sh" "$DIR/stop-kiosk.sh" 2>/dev/null || true

# --- Quitar el kiosco anterior para que no arranquen los dos
if [ -f "$OLD" ]; then
  rm -f "$OLD"
  echo "[kiosk] Entrada anterior eliminada: $OLD"
fi
pkill -f 'start-kiosk.sh' 2>/dev/null || true   # detiene el kiosco viejo si sigue corriendo

# --- Generar la entrada de autostart con la ruta absoluta correcta
mkdir -p "$AUTOSTART_DIR"
cat > "$TARGET" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=DEACERO Play Lite
Exec=$DIR/start-kiosk.sh "$URL"
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

echo "[kiosk] Autostart creado en: $TARGET"
echo "[kiosk]   Exec = $DIR/start-kiosk.sh $URL"

# --- Validar el .desktop si la herramienta está disponible
if command -v desktop-file-validate >/dev/null 2>&1; then
  if desktop-file-validate "$TARGET"; then
    echo "[kiosk] .desktop VÁLIDO ✓"
  else
    echo "[kiosk] ⚠ desktop-file-validate reportó avisos (arriba)."
  fi
else
  echo "[kiosk] (Opcional) instala 'desktop-file-utils' para validar el .desktop."
fi

echo "[kiosk] Listo. Reinicia la Raspberry para probar el arranque automático:"
echo "        sudo reboot"
