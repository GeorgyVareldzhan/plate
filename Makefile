PYTHON ?= python3
PORT   ?= 8080
ROOT   := public

.DEFAULT_GOAL := help
.PHONY: help serve lan icons

help: ## List commands
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  make %-8s %s\n", $$1, $$2}'

serve: ## Run locally at http://localhost:8080 (other port: PORT=9000)
	@echo "Откройте: http://localhost:$(PORT)"
	$(PYTHON) tools/serve.py --port $(PORT) --bind 127.0.0.1 --dir $(ROOT)

lan: ## Expose to a phone on the local network (offline mode will not work — HTTPS is required)
	@echo "Откройте на телефоне: http://$$(hostname -I | awk '{print $$1}'):$(PORT)"
	$(PYTHON) tools/serve.py --port $(PORT) --bind 0.0.0.0 --dir $(ROOT)

icons: ## Regenerate icons (requires Pillow)
	$(PYTHON) tools/icons.py $(ROOT)/icons
