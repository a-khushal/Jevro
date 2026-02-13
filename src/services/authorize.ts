import { policies } from "../store";
import { AuthorizeInput, Effect } from "../types";

export function authorize(input: AuthorizeInput): Effect {
  const matching = policies.filter((policy) => {
    return (
      policy.tenantId === input.tenantId &&
      policy.agentId === input.agentId &&
      policy.connector === input.connector &&
      policy.environment === input.environment &&
      policy.actions.includes(input.action)
    );
  });

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
