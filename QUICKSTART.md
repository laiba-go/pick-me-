# PickMe - Quick Start Guide

## Быстрый запуск

1. **Убедитесь, что Docker и Docker Compose установлены**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Запустите проект**

   С помощью Makefile (рекомендуется):
   ```bash
   make up-build
   ```
   
   Или напрямую:
   ```bash
   docker compose up --build
   ```

3. **Откройте в браузере**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Использование

1. **Создайте колоду (Deck)**
   - На главной странице нажмите "Create New Deck"
   - Введите название и описание
   - Нажмите "Save Deck"

2. **Добавьте карточки**
   - В редакторе колоды нажмите "+ Add Card"
   - Заполните информацию о карточке (название, описание, URL изображения)
   - Нажмите "Save Card" для каждой карточки

3. **Начните выбор**
   - Нажмите "Start Choosing" в редакторе колоды
   - **Фаза 1 - Swipe**: Проведите по карточкам, выбирая "Pass" (❌) или "Smash" (❤️)
   - **Фаза 2 - Duel**: Оставшиеся карточки вступают в батл 1 на 1
   - **Результат**: Победитель отображается на экране результата

## Остановка

С помощью Makefile:
```bash
make down          # Остановить проект
make down-volumes  # Остановить и удалить все данные (включая БД)
```

Или напрямую:
```bash
docker compose down        # Остановить проект
docker compose down -v     # Остановить и удалить volumes
```

## Полезные команды Makefile

Просмотреть все доступные команды:
```bash
make help
```

Основные команды:
- `make build` - Собрать Docker образы
- `make up` - Запустить проект (в фоне)
- `make up-build` - Собрать и запустить проект
- `make up-logs` - Запустить проект с выводом логов
- `make down` - Остановить проект
- `make restart` - Перезапустить проект
- `make logs` - Показать логи всех сервисов
- `make ps` - Показать статус контейнеров
- `make health` - Проверить здоровье сервисов
- `make clean` - Полная очистка проекта

## Структура проекта

```
pick-me-/
├── docker-compose.yml    # Конфигурация Docker Compose
├── backend/              # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── index.js     # Главный файл сервера
│   │   └── routes/      # API маршруты
│   └── db/
│       └── init.sql     # Схема базы данных
├── frontend/            # Frontend (React)
│   ├── src/
│   │   ├── App.jsx      # Главный компонент
│   │   └── components/  # React компоненты
└── README.md            # Полная документация
```

## Технологии

- **Backend**: Python, FastAPI, Uvicorn, PostgreSQL, Redis
- **Frontend**: React, React Router, Axios
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Containerization**: Docker, Docker Compose

## Решение проблем

### Порт уже занят
Измените порты в `docker-compose.yml` если 3000, 3001, 5432 или 6379 уже используются.

### База данных не подключается
Убедитесь, что контейнер PostgreSQL запущен и здоров:
```bash
docker-compose ps
```

### Frontend не может подключиться к Backend
Проверьте, что оба контейнера запущены и backend доступен на http://localhost:3001

