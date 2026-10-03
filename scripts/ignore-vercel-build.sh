#!/bin/bash
# Script para ignorar despliegues de Vercel cuando solo hay cambios en Móvil o Servidor
# Código de salida 0: Cancela el despliegue en Vercel (no hay cambios en web/admin)
# Código de salida 1: Procede con el despliegue en Vercel (hay cambios en web/admin)

echo "Verificando si hay cambios en la Web App / Admin..."

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURR="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Si no hay historial previo para comparar, compilar por precaución
if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  echo "No se encontró commit previo para comparar. Procediendo con el despliegue."
  exit 1
fi

# Comparar archivos pertenecientes exclusivamente a la Web App
if git diff --quiet "$PREV" "$CURR" -- \
  src/app/web/ \
  src/router/ \
  src/assets/ \
  src/types.ts \
  src/config.ts \
  src/superAdmin.ts \
  src/initialData.ts \
  src/utils/ \
  src/App.tsx \
  src/main.tsx \
  src/index.css \
  public/ \
  index.html \
  vite.config.ts \
  vercel.json; then
  echo "No se detectaron cambios en la Web App ni en Admin. Cancelando despliegue en Vercel."
  exit 0
else
  echo "Cambios detectados en Web App / Admin. Continuando despliegue en Vercel..."
  exit 1
fi
