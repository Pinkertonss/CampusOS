.PHONY: help install dev dev-backend dev-frontend test build clean

PYTHON ?= ./backend/venv/bin/python3
PIP ?= ./backend/venv/bin/pip
PYTEST ?= ./backend/venv/bin/pytest

help:
	@echo "CampusOS Monorepo Commands:"
	@echo "  make install      - Install backend and frontend dependencies"
	@echo "  make dev          - Start both backend and frontend dev servers concurrently"
	@echo "  make dev-backend  - Start FastAPI backend server on http://localhost:8000"
	@echo "  make dev-frontend - Start Next.js frontend dev server on http://localhost:3000"
	@echo "  make test         - Run backend tests and frontend type check"
	@echo "  make build        - Build frontend production bundle"
	@echo "  make clean        - Remove caches and build artifacts"

install:
	@echo "==> Setting up backend virtualenv..."
	python3 -m venv backend/venv
	$(PIP) install -r backend/requirements.txt
	@echo "==> Installing frontend dependencies..."
	cd frontend && npm install

dev-backend:
	@echo "==> Starting FastAPI backend server on http://localhost:8000..."
	$(PYTHON) -m uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000

dev-frontend:
	@echo "==> Starting Next.js frontend dev server on http://localhost:3000..."
	cd frontend && npm run dev

dev:
	@echo "==> Starting both dev servers (backend + frontend)..."
	@./scripts/dev.sh

test:
	@echo "==> Running backend test suite..."
	$(PYTEST) -v -W ignore::DeprecationWarning
	@echo "==> Building frontend to verify type-checking..."
	cd frontend && npm run build

build:
	@echo "==> Building frontend for production..."
	cd frontend && npm run build

clean:
	rm -rf .pytest_cache backend/__pycache__ backend/app/__pycache__ frontend/.next
