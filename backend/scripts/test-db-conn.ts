import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.$queryRaw`SELECT 1`
  .then(() => { console.log("✅ DB connection OK"); })
  .catch((e: Error) => { console.error("❌ DB error:", e.message); })
  .finally(() => p.$disconnect());
