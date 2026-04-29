import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating special job titles for tags...");

  const updates = [
    { email: "rutik.intellisys@gmail.com", title: "CEO" },
    { email: "mahesh.patil.intellisys@gmail.com", title: "Managing Director" },
    { email: "swapnil.deshmukh.intellisys@gmail.com", title: "HR" },
    { email: "rahuljadhav.intellisys@gmail.com", title: "Manager" },
  ];

  for (const update of updates) {
    const employee = await prisma.employee.findFirst({
      where: { user: { email: update.email } }
    });

    if (employee) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { jobTitle: update.title }
      });
      console.log(`Updated ${update.email} with title: ${update.title}`);
    }
  }

  console.log("Job titles updated successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
