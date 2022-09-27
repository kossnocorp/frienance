start:
	npx tsc --watch &
	@env GOOGLE_APPLICATION_CREDENTIALS=${CURDIR}/secrets/production/key.json \
			CLOUD_RUNTIME_CONFIG="${CURDIR}/secrets/production/runtime.json" \
			npx firebase emulators:start

test:
	npx jest

test-watch:
	npx jest --watch

build:
	npx tsc
.PHONY: build

deploy: build
	@cp firebase.json build
	@cp .firebaserc build
	@cp package.json build
	@cp package-lock.json build
	@cd build && npx firebase deploy