import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding shifts...");
  
  // 1. Create or get Standard Shift
  let standardShift = await prisma.shift.findUnique({
    where: { name: "Standard Shift" }
  });
  
  if (!standardShift) {
    standardShift = await prisma.shift.create({
      data: {
        name: "Standard Shift",
        startTime: "09:00",
        endTime: "18:00",
        requiredMinutes: 540,
        gracePeriodMinutes: 15
      }
    });
    console.log("Created Standard Shift:", standardShift);
  } else {
    console.log("Standard Shift already exists:", standardShift);
  }
  
  // 2. Map all employees with null shiftId to Standard Shift
  const employeesToUpdate = await prisma.employee.findMany({
    where: { shiftId: null }
  });
  
  console.log(`Found ${employeesToUpdate.length} employees without an assigned shift.`);
  
  if (employeesToUpdate.length > 0) {
    const updateResult = await prisma.employee.updateMany({
      where: { shiftId: null },
      data: {
        shiftId: standardShift.id
      }
    });
    console.log(`Successfully assigned ${updateResult.count} employees to Standard Shift.`);
  } else {
    console.log("All employees already have a shift assigned.");
  }
}

main()
  .catch((e) => {
    console.error("Error seeding shifts:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
