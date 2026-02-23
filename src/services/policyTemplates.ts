import { Effect, Environment } from "../types";

export type PolicyTemplate = {
  id: string;
  name: string;
  description: string;
  connector: string;
  actions: string[];
  environment: Environment;
  effect: Effect;
  priority: number;
  dryRun: boolean;
};

const templates: PolicyTemplate[] = [
  {
    id: "github-readonly-prod",
    name: "GitHub Read-Only Prod",
    description: "Allow read-only GitHub PR access in production.",
    connector: "github",
    actions: ["read_pr"],
    environment: "prod",
    effect: "allow",
    priority: 200,
    dryRun: false
  },
  {
    id: "slack-post-approval-prod",
    name: "Slack Post With Approval",
    description: "Require approval before posting Slack messages in production.",
    connector: "slack",
    actions: ["post_message"],
    environment: "prod",
    effect: "require_approval",
    priority: 150,
    dryRun: false
  },
  {
    id: "global-breakglass-deny",
    name: "Breakglass Deny",
    description: "High-priority deny template for emergency lock-down.",
    connector: "github",
    actions: ["read_pr", "comment_pr", "merge_pr"],
    environment: "prod",
    effect: "deny",
    priority: 1,
    dryRun: false
  }
];

export function listPolicyTemplates(): PolicyTemplate[] {
  return templates;
}

export function getPolicyTemplateById(templateId: string): PolicyTemplate | null {
  return templates.find((template) => template.id === templateId) ?? null;
}
