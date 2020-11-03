
BIN = $(shell npm bin)

start:
	@${BIN}/tsc --watch &
	@env GOOGLE_APPLICATION_CREDENTIALS=${CURDIR}/secrets/production/key.json \
			CLOUD_RUNTIME_CONFIG="${CURDIR}/secrets/production/runtime.json" \
			${BIN}/firebase emulators:start