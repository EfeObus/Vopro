.PHONY: up down logs ps build test lint frontend backend ai agent setup clean redis

up:
	docker compose up -d
	@echo "Frontend  → http://localhost:5173"
	@echo "Backend   → http://localhost:3000"
	@echo "AI engine → http://localhost:8000"

down:
	docker compose down

# Redis only — for manual Rails+Vite dev when you need Sidekiq jobs but not full `make up`.
redis:
	docker compose up -d redis
	@echo "Redis → localhost:6379 — run: cd backend && bundle exec sidekiq"

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

build:
	docker compose build

setup:
	cd frontend && npm install
	cd backend && bundle install && bin/rails db:create db:migrate
	cd ai-engine && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
	cd agent && npm install
	cd integrations && npm install

frontend:
	cd frontend && npm run dev

backend:
	cd backend && bin/rails server

ai:
	cd ai-engine && . .venv/bin/activate && uvicorn vopro_ai.api:app --reload

agent:
	cd agent && npm run dev

test:
	cd frontend && npm test --silent || true
	cd backend && bundle exec rspec || true
	cd ai-engine && . .venv/bin/activate && pytest || true

lint:
	cd frontend && npm run lint || true
	cd backend && bundle exec rubocop || true
	cd ai-engine && . .venv/bin/activate && ruff check . || true

clean:
	docker compose down -v
	rm -rf frontend/node_modules frontend/dist
	rm -rf backend/tmp backend/log
	rm -rf ai-engine/.venv ai-engine/__pycache__
	rm -rf agent/node_modules agent/dist
	rm -rf integrations/node_modules
