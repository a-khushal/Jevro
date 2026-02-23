import { HIGH_RISK_REQUIRED_APPROVALS, RISK_REQUIRE_APPROVAL_LEVELS } from "../config";
import { RiskLevel } from "../types";

const riskMatrix: Record<string, RiskLevel> = {
  "github:read_pr": "low",
  "github:comment_pr": "medium",
  "github:merge_pr": "high",
  "slack:post_message": "medium",
  "slack:read_channel": "low",
  "slack:lookup_user": "low",
  "jira:read_issue": "low",
  "jira:transition_issue": "high",
  "postgres:query_readonly": "medium"
};

export function getRiskLevel(connector: string, action: string): RiskLevel {
  return riskMatrix[`${connector}:${action}`] ?? "medium";
}

export function shouldRequireApprovalByRisk(riskLevel: RiskLevel): boolean {
  return RISK_REQUIRE_APPROVAL_LEVELS.includes(riskLevel);
}

export function getRequiredApprovalsForRisk(riskLevel: RiskLevel): number {
  if (riskLevel === "high" || riskLevel === "critical") {
    return HIGH_RISK_REQUIRED_APPROVALS;
  }

  return 1;
}
