import { app } from "./app";
import { APPROVAL_EXPIRATION_SWEEP_MS, PORT } from "./config";
import { startApprovalExpirationJob } from "./services/approvalExpirationJob";

startApprovalExpirationJob(APPROVAL_EXPIRATION_SWEEP_MS);

app.listen(PORT, () => {
  console.log(`Okta-for-Agents MVP server listening on port ${PORT}`);
});
