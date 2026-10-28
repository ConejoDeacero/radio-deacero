#!/usr/bin/env bash
# ============================================================================
#  DEACERO Play Lite — Detener el kiosco (Raspberry Pi)
# ============================================================================
#  Detiene el bucle de relanzado y cierra Chromium del kiosco.
# ============================================================================
echo "[kiosk] Deteniendo kiosco…"

# Detener el bucle lanzador
pkill -f 'start-kiosk.sh' 2>/dev/null || true

# Cerrar el Chromium del kiosco (identificado por su perfil aislado)
pkill -f 'deacero-kiosk-profile' 2>/dev/null || true

echo "[kiosk] Listo."
