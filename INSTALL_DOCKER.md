# Установка Docker и Docker Compose

## Способ 1: Автоматическая установка (рекомендуется)

Выполните скрипт установки:

```bash
chmod +x install-docker.sh
./install-docker.sh
```

После установки **обязательно выйдите и войдите снова** (или выполните `newgrp docker`), чтобы изменения группы вступили в силу.

## Способ 2: Ручная установка

### Шаг 1: Обновите список пакетов
```bash
sudo apt update
```

### Шаг 2: Установите зависимости
```bash
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

### Шаг 3: Добавьте официальный GPG ключ Docker
```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

### Шаг 4: Добавьте репозиторий Docker
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Шаг 5: Обновите список пакетов
```bash
sudo apt update
```

### Шаг 6: Установите Docker
```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Шаг 7: Добавьте пользователя в группу docker
```bash
sudo usermod -aG docker $USER
```

### Шаг 8: Выйдите и войдите снова
```bash
# Выйдите из сессии и войдите снова, или выполните:
newgrp docker
```

### Шаг 9: Проверьте установку
```bash
docker --version
docker compose version
```

## Способ 3: Быстрая установка через docker.io (альтернатива)

Если официальный репозиторий не работает, можно установить из стандартных репозиториев:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker  # или выйдите и войдите снова
```

## Проверка работы

После установки проверьте:

```bash
docker run hello-world
```

Если команда выполнилась успешно, Docker установлен правильно!

## Запуск проекта PickMe

После успешной установки Docker:

```bash
cd ~/pick-me-
docker compose up --build
```

## Решение проблем

### Ошибка "permission denied"
Если получаете ошибку доступа, убедитесь, что вы:
1. Добавили пользователя в группу docker: `sudo usermod -aG docker $USER`
2. Вышли и вошли снова (или выполнили `newgrp docker`)

### Ошибка "Cannot connect to the Docker daemon"
Убедитесь, что служба Docker запущена:
```bash
sudo systemctl start docker
sudo systemctl enable docker  # для автозапуска
```

### В WSL2
Если используете WSL2, убедитесь, что Docker Desktop для Windows установлен, или установите Docker напрямую в WSL2 по инструкции выше.

