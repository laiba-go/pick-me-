.PHONY: help build up down restart logs clean ps shell-backend shell-frontend shell-db health

# Переменные
COMPOSE = docker compose
COMPOSE_FILE = docker-compose.yml

# Цвета для вывода
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

help: ## Показать эту справку
	@echo "$(GREEN)Доступные команды:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(RESET) %s\n", $$1, $$2}'

build: ## Собрать Docker образы
	@echo "$(GREEN)Сборка Docker образов...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) build

up: ## Запустить проект (в фоне)
	@echo "$(GREEN)Запуск проекта...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) up -d

up-build: build up ## Собрать и запустить проект

up-logs: ## Запустить проект с выводом логов
	@echo "$(GREEN)Запуск проекта с логами...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) up

down: ## Остановить проект
	@echo "$(GREEN)Остановка проекта...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) down

down-volumes: ## Остановить проект и удалить volumes (включая БД)
	@echo "$(YELLOW)Остановка проекта и удаление всех данных...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) down -v

restart: down up ## Перезапустить проект

restart-build: down up-build ## Перезапустить проект с пересборкой

logs: ## Показать логи всех сервисов
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

logs-backend: ## Показать логи backend
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f backend

logs-frontend: ## Показать логи frontend
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f frontend

logs-db: ## Показать логи базы данных
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f postgres

ps: ## Показать статус контейнеров
	$(COMPOSE) -f $(COMPOSE_FILE) ps

health: ## Проверить здоровье сервисов
	@echo "$(GREEN)Проверка здоровья сервисов...$(RESET)"
	@echo "Backend health:"
	@curl -s http://localhost:3001/health | python3 -m json.tool || echo "Backend недоступен"
	@echo "\nFrontend: http://localhost:3000"
	@echo "Backend API: http://localhost:3001"
	@echo "PostgreSQL: localhost:5432"
	@echo "Redis: localhost:6379"

shell-backend: ## Открыть shell в контейнере backend
	$(COMPOSE) -f $(COMPOSE_FILE) exec backend bash

shell-frontend: ## Открыть shell в контейнере frontend
	$(COMPOSE) -f $(COMPOSE_FILE) exec frontend sh

shell-db: ## Открыть psql в контейнере базы данных
	$(COMPOSE) -f $(COMPOSE_FILE) exec postgres psql -U pickme -d pickme_db

clean: ## Остановить и удалить контейнеры, сети, volumes и образы
	@echo "$(YELLOW)Полная очистка проекта...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) down -v --rmi all --remove-orphans

clean-images: ## Удалить только образы проекта
	$(COMPOSE) -f $(COMPOSE_FILE) down --rmi all

rebuild: clean build up ## Полная пересборка проекта

stop: ## Остановить контейнеры (без удаления)
	$(COMPOSE) -f $(COMPOSE_FILE) stop

start: ## Запустить остановленные контейнеры
	$(COMPOSE) -f $(COMPOSE_FILE) start

# Команды для разработки
dev-backend: ## Запустить только backend для разработки
	$(COMPOSE) -f $(COMPOSE_FILE) up -d postgres redis
	@echo "$(GREEN)Backend сервисы запущены. Запустите backend локально:$(RESET)"
	@echo "  cd backend && pip install -r requirements.txt && uvicorn main:app --reload"

dev-frontend: ## Запустить только frontend для разработки
	$(COMPOSE) -f $(COMPOSE_FILE) up -d backend postgres redis
	@echo "$(GREEN)Backend сервисы запущены. Запустите frontend локально:$(RESET)"
	@echo "  cd frontend && npm install && npm start"

# Команды для базы данных
db-reset: ## Сбросить базу данных (удалить и создать заново)
	@echo "$(YELLOW)Сброс базы данных...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) down -v
	$(COMPOSE) -f $(COMPOSE_FILE) up -d postgres
	@echo "$(GREEN)База данных пересоздана$(RESET)"

db-backup: ## Создать backup базы данных
	@mkdir -p backups
	@echo "$(GREEN)Создание backup базы данных...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) exec -T postgres pg_dump -U pickme pickme_db > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup сохранен в директории backups/$(RESET)"

# Установка зависимостей (если нужно запускать локально)
install-backend: ## Установить зависимости backend
	cd backend && pip install -r requirements.txt

install-frontend: ## Установить зависимости frontend
	cd frontend && npm install

install: install-backend install-frontend ## Установить все зависимости

# По умолчанию показываем справку
.DEFAULT_GOAL := help

