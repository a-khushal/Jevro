#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.test.yml"
TEST_DB_PORT="${TEST_DB_PORT:-55432}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/agent_auth?schema=public}"
export REQUIRE_DB_TESTS=1
export TEST_DB_PORT

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v
}

trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" up -d

for i in {1..40}; do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres-test pg_isready -U postgres -d agent_auth >/dev/null 2>&1; then
    break
  fi

  if [ "$i" -eq 40 ]; then
    echo "postgres-test did not become ready in time"
    exit 1
  fi

  sleep 1
done

npm run prisma:deploy
npm run test:db
