"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("../../src/sdk/typescript");
const baseUrl = (_a = process.env.API_BASE_URL) !== null && _a !== void 0 ? _a : "http://localhost:8080/v1";
const tenantId = (_b = process.env.TENANT_ID) !== null && _b !== void 0 ? _b : "acme";
const agentId = process.env.AGENT_ID;
const approverId = (_c = process.env.APPROVER_ID) !== null && _c !== void 0 ? _c : "sec-lead-1";
if (!agentId) {
    throw new Error("Set AGENT_ID before running example agent.");
}
const resolvedAgentId = agentId;
let bearerToken;
const client = new typescript_1.OktaForAgentsClient({
    baseUrl,
    getToken: () => bearerToken
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const minted = yield client.mintToken({ tenantId, agentId: resolvedAgentId });
        bearerToken = minted.token;
        const firstAttempt = yield client.runAction({
            connector: "slack",
            action: "post_message",
            payload: {
                channel: "#ops",
                text: "deploy complete"
            },
            environment: "prod"
        });
        if (firstAttempt.decision === "allow") {
            console.log("Action allowed without approval.");
            return;
        }
        if (firstAttempt.decision === "deny") {
            console.log("Action denied by policy.");
            return;
        }
        if (!((_a = firstAttempt.approval) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new Error("Approval was required but no approval id was returned.");
        }
        console.log(`Approval required. approvalId=${firstAttempt.approval.id}`);
        if (process.env.AUTO_APPROVE === "1") {
            yield client.resolveApproval({
                approvalId: firstAttempt.approval.id,
                tenantId,
                approverId,
                decision: "approved"
            });
            const replay = yield client.replayApprovedAction({
                connector: "slack",
                action: "post_message",
                payload: {
                    channel: "#ops",
                    text: "deploy complete (approved replay)"
                },
                approvalId: firstAttempt.approval.id,
                environment: "prod"
            });
            console.log(`Replay decision: ${replay.decision}`);
            return;
        }
        console.log("Resolve the approval in Slack or via API, then replay with approvalId.");
    });
}
run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
