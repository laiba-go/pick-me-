#!/bin/bash

# Скрипт для исправления прав доступа к Docker

echo "=== Исправление прав доступа к Docker ==="

# Добавление пользователя в группу docker
echo "Добавляю пользователя $USER в группу docker..."
sudo usermod -aG docker $USER

echo ""
echo "=== Готово! ==="
echo ""
echo "ВАЖНО: Вам нужно выполнить одно из следующих действий:"
echo "  1. Выйти и войти снова в систему"
echo "  2. Или выполнить команду: newgrp docker"
echo ""
echo "После этого проверьте права:"
echo "  docker ps"
echo ""
echo "Если команда работает, запустите проект:"
echo "  docker compose up --build"

