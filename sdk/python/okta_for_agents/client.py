from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional
import json
import urllib.request
import urllib.error


class OktaForAgentsError(RuntimeError):
    pass


@dataclass
class MintTokenResponse:
    token: str
    expires_in_seconds: int
    kid: Optional[str] = None
    jti: Optional[str] = None


class OktaForAgentsClient:
    def __init__(
        self, base_url: str, get_token: Optional[Callable[[], Optional[str]]] = None
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.get_token = get_token

    def mint_token(self, tenant_id: str, agent_id: str) -> MintTokenResponse:
        body = self._request_json(
            "/tokens/mint",
            method="POST",
            payload={"tenantId": tenant_id, "agentId": agent_id},
        )
        return MintTokenResponse(
            token=body["token"],
            expires_in_seconds=int(body["expiresInSeconds"]),
            kid=body.get("kid"),
            jti=body.get("jti"),
        )

    def run_action(
        self,
        connector: str,
        action: str,
        payload: Dict[str, Any],
        environment: Optional[str] = None,
        approval_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        token = self._require_token()
        request_payload: Dict[str, Any] = {"payload": payload}
        if environment is not None:
            request_payload["environment"] = environment
        if approval_id is not None:
            request_payload["approvalId"] = approval_id

        return self._request_json(
            f"/proxy/{connector}/{action}",
            method="POST",
            payload=request_payload,
            token=token,
        )

    def resolve_approval(
        self, approval_id: str, tenant_id: str, approver_id: str, decision: str
    ) -> Dict[str, Any]:
        return self._request_json(
            f"/approvals/{approval_id}/decision",
            method="POST",
            payload={
                "tenantId": tenant_id,
                "approverId": approver_id,
                "decision": decision,
            },
        )

    def replay_approved_action(
        self,
        connector: str,
        action: str,
        payload: Dict[str, Any],
        approval_id: str,
        environment: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.run_action(
            connector=connector,
            action=action,
            payload=payload,
            approval_id=approval_id,
            environment=environment,
        )

    def _require_token(self) -> str:
        token = self.get_token() if self.get_token is not None else None
        if not token:
            raise OktaForAgentsError(
                "No bearer token available. Provide get_token and mint/assign token first."
            )
        return token

    def _request_json(
        self,
        path: str,
        method: str,
        payload: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        data = (
            json.dumps(payload or {}).encode("utf-8") if payload is not None else None
        )
        headers = {"content-type": "application/json"}
        if token:
            headers["authorization"] = f"Bearer {token}"

        request = urllib.request.Request(
            url=f"{self.base_url}{path}",
            method=method,
            data=data,
            headers=headers,
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8")
            try:
                body = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                body = {}
            code = body.get("code", "HTTP_ERROR")
            message = body.get("error", str(error))
            raise OktaForAgentsError(f"{code}: {message}") from error
