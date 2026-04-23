import { prisma } from "./src/config/prisma.js";

async function checkExceptions() {
  const all = await prisma.calendarException.findMany({
    orderBy: { date: 'asc' }
  });
  
  console.log("Found " + all.length + " exceptions in DB:");
  all.forEach(e => {
    console.log(`- ${e.date.toISOString().split('T')[0]}: ${e.type} (${e.name})`);
  });
  
  const future = all.filter(e => e.date >= new Date());
  console.log("\nFuture exceptions: " + future.length);
}

checkExceptions();
