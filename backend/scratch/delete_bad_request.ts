
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const requestId = 1; // The ID we identified earlier
  
  try {
    const deleted = await prisma.attendanceRegularizationRequest.delete({
      where: { id: requestId }
    });
    console.log(`Successfully deleted regularization request ID: ${deleted.id}`);
  } catch (error) {
    console.error(`Failed to delete request ID ${requestId}:`, error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
