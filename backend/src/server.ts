import { env } from "./config/env.js";
import { app } from "./app.js";
import { initScheduler } from "./config/scheduler.js";

// Initialize Background Tasks
initScheduler();

app.listen(env.PORT, () => {
  console.log(`HRMS backend running on port ${env.PORT}`);
});
