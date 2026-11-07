install:
	npm ci

setup: install build

build:
	npm run build

dev:
	npm run dev

start:
	npm run preview

test:
	npm test

lint:
	npm run lint

lint-arch:
	npm run lint:arch

lint-fix:
	npm run lint:fix

.PHONY: install setup build dev start test lint lint-arch lint-fix
