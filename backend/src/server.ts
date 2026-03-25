import { env } from "./config/env.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(`HRMS backend running on port ${env.PORT}`);
});
