import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'testuser@intellisys.com';
  const password = 'Test@1234';

  // Find or get EMPLOYEE role
  const role = await prisma.role.findUnique({ where: { name: RoleName.EMPLOYEE } });
  if (!role) throw new Error('EMPLOYEE role not found');

  // Find default department
  let department = await prisma.department.findFirst({ where: { code: 'SD' } });
  if (!department) department = await prisma.department.findFirst();
  if (!department) throw new Error('No department found');

  // Find a shift
  const shift = await prisma.shift.findFirst();

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Test account already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Create user + employee in one transaction
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      roleId: role.id,
      employee: {
        create: {
          firstName: 'Test',
          lastName: 'User',
          employeeCode: 'TEST-001',
          jobTitle: 'QA Tester',
          gender: 'MALE',
          employmentStatus: 'ACTIVE',
          employmentType: 'FULL_TIME',
          isOnProbation: false,
          departmentId: department.id,
          shiftId: shift?.id ?? null,
          joiningDate: new Date('2026-06-01T00:00:00.000Z'),
          annualPackageLpa: 5,
        }
      }
    },
    include: { employee: true }
  });

  console.log('');
  console.log('✅ Test account created successfully!');
  console.log('========================================');
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log(`  Role     : EMPLOYEE`);
  console.log(`  Name     : Test User`);
  console.log(`  Emp Code : TEST-001`);
  console.log(`  User ID  : ${user.id}`);
  console.log(`  Emp ID   : ${user.employee?.id}`);
  console.log('========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
