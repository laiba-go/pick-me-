#!/bin/bash

# Скрипт установки Docker и Docker Compose для Ubuntu/Debian

echo "=== Установка Docker ==="

# Обновление списка пакетов
sudo apt update

# Установка необходимых зависимостей
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Добавление официального GPG ключа Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавление репозитория Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Обновление списка пакетов
sudo apt update

# Установка Docker Engine, Docker CLI и Containerd
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавление текущего пользователя в группу docker (чтобы не использовать sudo)
sudo usermod -aG docker $USER

# Проверка установки
echo ""
echo "=== Проверка установки ==="
docker --version
docker compose version

echo ""
echo "=== Установка завершена! ==="
echo "ВАЖНО: Вам нужно выйти и войти снова (или выполнить 'newgrp docker'),"
echo "чтобы изменения группы вступили в силу."
echo ""
echo "После этого вы сможете запустить проект:"
echo "  docker compose up --build"

