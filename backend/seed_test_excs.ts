import { prisma } from "./src/config/prisma.js";

async function addTestExceptions() {
  const exceptions = [
    { date: new Date('2026-05-01'), type: 'HOLIDAY', name: 'May Day', createdById: 1 },
    { date: new Date('2026-05-09'), type: 'WORKING_SATURDAY', name: 'Work Marathon', createdById: 1 },
    { date: new Date('2026-05-23'), type: 'WORKING_SATURDAY', name: 'Project Deadline', createdById: 1 },
  ];

  for (const ex of exceptions) {
    await prisma.calendarException.upsert({
      where: { date: ex.date },
      update: { type: ex.type as any, name: ex.name },
      create: ex as any
    });
  }
  
  console.log("Successfully added future test exceptions for May 2026!");
}

addTestExceptions();
