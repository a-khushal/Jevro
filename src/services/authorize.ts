import { listMatchingPolicies } from "../db";
import { AuthorizeInput, Effect } from "../types";

export async function authorize(input: AuthorizeInput): Promise<Effect> {
  const matching = await listMatchingPolicies(input);

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
