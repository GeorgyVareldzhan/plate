PYTHON ?= python3
PORT   ?= 8080

.DEFAULT_GOAL := help
.PHONY: help install dev lan preview icons

help: ## List commands
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  make %-8s %s\n", $$1, $$2}'

install: ## Install dependencies (needs Node 20.19+ or 22.12+)
	npm ci

dev: ## Run the dev server at http://localhost:8080 (other port: PORT=9000); no service worker
	npx vite --port $(PORT)

lan: ## Expose the dev server to a phone on the local network (offline mode will not work — HTTPS is required)
	npx vite --port $(PORT) --host

preview: ## Build and serve the production version (with the service worker) at http://localhost:8080
	npm run build && npx vite preview --port $(PORT)

icons: ## Regenerate icons (requires Pillow)
	$(PYTHON) tools/icons.py public/icons
