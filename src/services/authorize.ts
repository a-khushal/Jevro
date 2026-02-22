import { listMatchingPolicies } from "../db";
import { AuthorizeInput, Effect } from "../types";

export function evaluatePolicyDecision(matching: Array<{ effect: string }>): Effect {
  if (matching.some((policy) => policy.effect === "deny")) {
    return "deny";
  }

  if (matching.some((policy) => policy.effect === "require_approval")) {
    return "require_approval";
  }

  if (matching.some((policy) => policy.effect === "allow")) {
    return "allow";
  }

  return "deny";
}

export async function authorize(input: AuthorizeInput): Promise<Effect> {
  const matching = await listMatchingPolicies(input);
  return evaluatePolicyDecision(matching);
}
