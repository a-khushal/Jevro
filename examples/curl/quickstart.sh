#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080/v1}"
TENANT_ID="${TENANT_ID:-acme}"

echo "Creating agent..."
AGENT_JSON=$(curl -s -X POST "$BASE_URL/agents" \
  -H "content-type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"name\":\"release-agent\",\"environment\":\"prod\"}")
AGENT_ID=$(echo "$AGENT_JSON" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).id))")

echo "Creating policy..."
curl -s -X POST "$BASE_URL/policies" \
  -H "content-type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"agentId\":\"$AGENT_ID\",\"connector\":\"github\",\"actions\":[\"read_pr\"],\"environment\":\"prod\",\"effect\":\"allow\"}" >/dev/null

echo "Minting token..."
TOKEN_JSON=$(curl -s -X POST "$BASE_URL/tokens/mint" \
  -H "content-type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"agentId\":\"$AGENT_ID\"}")
TOKEN=$(echo "$TOKEN_JSON" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).token))")

echo "Calling proxy..."
curl -s -X POST "$BASE_URL/proxy/github/read_pr" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d '{"payload":{"owner":"acme","repo":"api","pull_number":42},"environment":"prod"}'

echo "\nDone."
