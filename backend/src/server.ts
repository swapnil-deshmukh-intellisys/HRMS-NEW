import { env } from "./config/env.js";
import { app } from "./app.js";
import { initScheduler } from "./config/scheduler.js";
import { initDirectories } from "./config/init-dirs.js";

// Initialize Environment
initDirectories();
initScheduler();

app.listen(env.PORT, () => {
  console.log(`HRMS backend running on port ${env.PORT}`);
});

// Trigger templates watch reload v12
