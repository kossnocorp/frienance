
BIN = $(shell npm bin)

start:
	@${BIN}/tsc --watch &
	@env GOOGLE_APPLICATION_CREDENTIALS=${CURDIR}/secrets/production/key.json \
			CLOUD_RUNTIME_CONFIG="${CURDIR}/secrets/production/runtime.json" \
			${BIN}/firebase emulators:start

test:
	@${BIN}/jest

test-watch:
	@${BIN}/jest --watch

deploy:
	@cp firebase.json build
	@cp .firebaserc build
	@cp package.json build
	@cp package-lock.json build
	@cd build && ${BIN}/firebase deploy