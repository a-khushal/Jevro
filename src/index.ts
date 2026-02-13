import { app } from "./app";
import { PORT } from "./config";

app.listen(PORT, () => {
    console.log(`Okta-for-Agents MVP server listening on port ${PORT}`);
});
