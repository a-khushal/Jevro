import { listMatchingPolicies } from "../db";
import { getRiskLevel, shouldRequireApprovalByRisk } from "./risk";
import { AuthorizeInput, Effect } from "../types";

function decideByConflictRules(matching: Array<{ effect: string; priority?: number }>): Effect {
  if (matching.length === 0) {
    return "deny";
  }

  const highestPriority = Math.min(...matching.map((policy) => policy.priority ?? 100));
  const candidates = matching.filter((policy) => (policy.priority ?? 100) === highestPriority);

  if (candidates.some((policy) => policy.effect === "deny")) {
    return "deny";
  }

  if (candidates.some((policy) => policy.effect === "require_approval")) {
    return "require_approval";
  }

  if (candidates.some((policy) => policy.effect === "allow")) {
    return "allow";
  }

  return "deny";
}

export function evaluatePolicyDecision(matching: Array<{ effect: string; priority?: number; dryRun?: boolean }>): Effect {
  const enforceable = matching.filter((policy) => !policy.dryRun);
  return decideByConflictRules(enforceable);
}

export function evaluateShadowDecision(matching: Array<{ effect: string; priority?: number; dryRun?: boolean }>): Effect {
  const shadow = matching.filter((policy) => policy.dryRun);
  return decideByConflictRules(shadow);
}

export function applyRiskBasedApproval(decision: Effect, connector: string, action: string): Effect {
  if (decision !== "allow") {
    return decision;
  }

  const risk = getRiskLevel(connector, action);
  if (shouldRequireApprovalByRisk(risk)) {
    return "require_approval";
  }

  return decision;
}

export async function authorizeDetailed(input: AuthorizeInput): Promise<{
  decision: Effect;
  baseDecision: Effect;
  shadowDecision: Effect;
  riskLevel: string;
}> {
  const matching = await listMatchingPolicies(input);
  const baseDecision = evaluatePolicyDecision(matching);
  const shadowDecision = evaluateShadowDecision(matching);
  const riskLevel = getRiskLevel(input.connector, input.action);
  const decision = applyRiskBasedApproval(baseDecision, input.connector, input.action);

  return {
    decision,
    baseDecision,
    shadowDecision,
    riskLevel
  };
}

export async function authorize(input: AuthorizeInput): Promise<Effect> {
  const detailed = await authorizeDetailed(input);
  return detailed.decision;
}
