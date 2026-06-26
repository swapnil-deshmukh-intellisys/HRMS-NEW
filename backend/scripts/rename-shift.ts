import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.shift.updateMany({
    where: { name: "Standard Shift" },
    data: { name: "Day Shift" },
  });
  console.log(`Updated ${result.count} shift(s) from "Standard Shift" → "Day Shift"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
