#!/usr/bin/env bash
# ============================================================================
#  DEACERO Play Lite — Lanzador de kiosco para Raspberry Pi (pantalla táctil)
# ============================================================================
#  Abre la app en Chromium a PANTALLA COMPLETA (modo --kiosk),
#  con autoplay permitido y sin ahorro de pantalla, y la mantiene viva 24/7
#  (relanza Chromium si se cierra o falla).
#
#  USO:
#     ./start-kiosk.sh [URL]
#     (por defecto: http://localhost:8000, el servidor corre en esta misma Pi)
#
#  Salir con el teclado: Ctrl+Shift+Q (cierra Chromium; el bucle lo relanza).
#  Para DETENER el kiosco por completo: ./stop-kiosk.sh
# ============================================================================
set -u

URL="${1:-http://localhost:8000}"

# --- Detectar el binario de Chromium (Bookworm: chromium; anterior: chromium-browser)
CHROMIUM="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROMIUM" ]; then
  echo "[kiosk] No se encontró Chromium. Instálalo con:" >&2
  echo "        sudo apt update && sudo apt install -y chromium-browser unclutter curl" >&2
  exit 1
fi

# --- Esperar a que el servidor (servicio play-lite) responda; evita abrir una página de error al arrancar
ORIGIN="$(printf %s "$URL" | sed -E 's#^(https?://[^/]+).*#\1#')"   # la URL puede llevar /?mode=video
until curl -fs "$ORIGIN/api/health" >/dev/null 2>&1; do
  echo "[kiosk] Esperando al servidor en $URL …"
  sleep 2
done

# --- Perfil aislado (no toca el navegador personal del usuario)
PROFILE="$HOME/.deacero-kiosk-profile"
mkdir -p "$PROFILE"

# --- Desactivar apagado de pantalla y salvapantallas (solo X11).
#     En Raspberry Pi OS Bookworm (Wayland) desactívalo además con:
#       sudo raspi-config → Display Options → Screen Blanking → No
if [ "${XDG_SESSION_TYPE:-x11}" = "x11" ] && command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
  # Ocultar el puntero del mouse cuando no se usa (por si hay mouse conectado)
  command -v unclutter >/dev/null 2>&1 && unclutter -idle 0 -root &
fi

# --- Evitar el diálogo "¿Restaurar páginas?" tras un corte de energía
PREFS="$PROFILE/Default/Preferences"
if [ -f "$PREFS" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS" 2>/dev/null || true
fi

echo "[kiosk] Iniciando DEACERO Play Lite → $URL"

# --- Bucle 24/7: relanza Chromium si termina
while true; do
  "$CHROMIUM" \
    --kiosk "$URL" \
    --user-data-dir="$PROFILE" \
    --autoplay-policy=no-user-gesture-required \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=Translate,TranslateUI \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --touch-events=enabled \
    --start-fullscreen \
    ${KIOSK_EXTRA_FLAGS:-}
  echo "[kiosk] Chromium terminó (código $?). Relanzando en 3 s…"
  sleep 3
done
