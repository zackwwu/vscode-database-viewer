.PHONY: build package install clean dev test

build:
	npm run build

package: build
	npx vsce package --allow-missing-repository

install: deps package
	code --install-extension $$(ls -t database-viewer-*.vsix | head -1)

deps:
	npm install

clean:
	rm -rf dist *.vsix

dev:
	npm run dev

test:
	npx vitest run
