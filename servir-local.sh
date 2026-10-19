#!/usr/bin/env bash
# ============================================================
#  Fulltraining · Control de pagos — servidor local de pruebas
#
#  Uso:
#    ./servir-local.sh          → arranca en http://localhost:8083
#    ./servir-local.sh parar    → detiene el servidor
#
#  Nota: esto es solo para probar en el propio dispositivo.
#  Para instalar la PWA en el móvil hace falta publicarla en
#  una dirección HTTPS (ver README.md). Con Termux abierto y
#  esta app instalada no necesitas el servidor: los datos y la
#  interfaz quedan en el propio móvil.
# ============================================================
set -u

PUERTO=8083
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/tmp/opencode"
PID_FILE="$LOG_DIR/fulltraining-$PUERTO.pid"

responde() {
  curl -s -o /dev/null --max-time 2 "http://localhost:$PUERTO/"
}

if [ "${1:-}" = "parar" ]; then
  if [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "⏹ Servidor detenido."
  else
    echo "· No estaba corriendo."
  fi
  exit 0
fi

if responde; then
  echo "✅ Ya estaba en marcha → http://localhost:$PUERTO"
  exit 0
fi

mkdir -p "$LOG_DIR"
nohup python3 -m http.server "$PUERTO" --directory "$DIR" \
  >"$LOG_DIR/servidor-$PUERTO.log" 2>&1 &
echo $! >"$PID_FILE"

for intento in 1 2 3 4 5 6 7 8 9 10; do
  if responde; then
    echo "▶ Fulltraining → http://localhost:$PUERTO"
    echo "   (abre esa dirección en el navegador de este dispositivo)"
    exit 0
  fi
  sleep 0.5
done

echo "⚠️  No responde; revisa $LOG_DIR/servidor-$PUERTO.log"
exit 1
