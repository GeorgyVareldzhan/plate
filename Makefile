PYTHON ?= python3
PORT   ?= 8080
ROOT   := public

.DEFAULT_GOAL := help
.PHONY: help serve lan icons

help: ## Список команд
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  make %-8s %s\n", $$1, $$2}'

serve: ## Запустить локально на http://localhost:8080 (другой порт: PORT=9000)
	@echo "Откройте: http://localhost:$(PORT)"
	$(PYTHON) tools/serve.py --port $(PORT) --bind 127.0.0.1 --dir $(ROOT)

lan: ## Открыть для телефона в локальной сети (офлайн-режим работать не будет — нужен HTTPS)
	@echo "Откройте на телефоне: http://$$(hostname -I | awk '{print $$1}'):$(PORT)"
	$(PYTHON) tools/serve.py --port $(PORT) --bind 0.0.0.0 --dir $(ROOT)

icons: ## Перегенерировать иконки (нужен Pillow)
	$(PYTHON) tools/icons.py $(ROOT)/icons
