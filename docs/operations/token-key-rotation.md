# Token Signing Key Rotation Runbook

## Objective

Rotate HMAC signing keys without interrupting token verification.

## Steps

1. Create a new key:

```bash
curl -s -X POST http://localhost:8080/v1/tokens/keys \
  -H "content-type: application/json" \
  -d '{"kid":"kid-2026-02","secret":"replace-with-very-long-secret","activate":false}'
```

2. Activate the key:

```bash
curl -s -X POST http://localhost:8080/v1/tokens/keys/kid-2026-02/activate
```

3. Verify active key list:

```bash
curl -s http://localhost:8080/v1/tokens/keys
```

4. Revoke suspicious tokens if needed:

```bash
curl -s -X POST http://localhost:8080/v1/tokens/revoke \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","token":"<token>","reason":"rotation_cleanup"}'
```

## Notes

- Existing tokens signed with prior keys remain verifiable until expiry.
- Rotate secrets at least quarterly or after security incidents.
- Keep key secrets in a secure secret manager and inject at request time.
