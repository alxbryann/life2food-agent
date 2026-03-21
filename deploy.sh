#!/bin/bash

# Script para desplegar actualizaciones de Lifo (life2food-agent)
# Autor: Life2Food
# Fecha: 2026-03-19

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuración del servidor
SSH_KEY="~/Downloads/life2food.pem"
SERVER_USER="ec2-user"
SERVER_IP="3.149.164.235"
REMOTE_PATH="/home/ec2-user/life2food-agent"
CONTAINER_NAME="lifo-agent"
IMAGE_NAME="lifo-agent"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Desplegando Lifo Agent (Node + Docker)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Expandir tilde en SSH_KEY
EXPANDED_KEY="${SSH_KEY/\~/$HOME}"
if [ ! -f "$EXPANDED_KEY" ]; then
    echo -e "${RED}Error: No se encuentra la clave SSH en $SSH_KEY${NC}"
    exit 1
fi
SSH_KEY="$EXPANDED_KEY"
chmod 400 "$SSH_KEY"

echo -e "${GREEN}✓${NC} 1. Transfiriendo código al servidor ${SERVER_IP} vía rsync..."
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.git' --exclude '.env' \
    -e "ssh -i $SSH_KEY" \
    ./ "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Error transfiriendo archivos.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Código transferido."
echo ""

echo -e "${GREEN}✓${NC} 2. Construyendo imagen Docker y reiniciando contenedor en el servidor..."
ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_IP}" << EOF
    set -e
    cd ${REMOTE_PATH}

    echo "  → Construyendo imagen..."
    docker build -t ${IMAGE_NAME}:latest .

    echo "  → Reemplazando contenedor..."
    docker stop ${CONTAINER_NAME} 2>/dev/null || true
    docker rm ${CONTAINER_NAME} 2>/dev/null || true

    docker run -d \
        --name ${CONTAINER_NAME} \
        --restart unless-stopped \
        --env-file ${REMOTE_PATH}/.env \
        -p 3002:3001 \
        ${IMAGE_NAME}:latest

    echo "  → Limpiando imágenes antiguas..."
    docker image prune -f --filter "label!=keep" 2>/dev/null || true

    sleep 2
    echo ""
    STATUS=\$(curl -s http://localhost:3002/health)
    echo "  Health check: \$STATUS"
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  ✓ Despliegue completado con éxito${NC}"
    echo -e "${GREEN}  ✓ https://lifo.life2food.com${NC}"
    echo -e "${GREEN}================================================${NC}"
else
    echo ""
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}  ✗ Error durante el despliegue en el servidor${NC}"
    echo -e "${RED}================================================${NC}"
    exit 1
fi
