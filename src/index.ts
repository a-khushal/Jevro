import { app } from "./app";
import { APPROVAL_EXPIRATION_SWEEP_MS, PORT, RETENTION_SWEEP_MS } from "./config";
import { startApprovalExpirationJob } from "./services/approvalExpirationJob";
import { startDataRetentionJob } from "./services/dataRetentionJob";

startApprovalExpirationJob(APPROVAL_EXPIRATION_SWEEP_MS);
startDataRetentionJob(RETENTION_SWEEP_MS);

app.listen(PORT, () => {
  console.log(`Okta-for-Agents MVP server listening on port ${PORT}`);
});
