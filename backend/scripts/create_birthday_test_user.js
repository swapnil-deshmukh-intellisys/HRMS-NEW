import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'birthday.test@intellisys.com';
  const password = 'Password@123';
  const hashedPassword = await bcrypt.hash(password, 10);
  const today = new Date();
  
  // Set birthday to today (Year 1990 for testing)
  const dob = new Date(Date.UTC(1990, today.getMonth(), today.getDate(), 0, 0, 0));

  console.log(`🚀 Creating test user with birthday: ${dob.toISOString()}`);

  const role = await prisma.role.findUnique({ where: { name: 'EMPLOYEE' } });
  if (!role) throw new Error('Role EMPLOYEE not found');

  const dept = await prisma.department.findFirst();
  if (!dept) throw new Error('No department found');

  // Find if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { employee: true }
  });

  if (existingUser) {
    console.log('🔄 User exists, updating birthday...');
    await prisma.employee.update({
      where: { id: existingUser.employee.id },
      data: { dateOfBirth: dob }
    });
  } else {
    console.log('🆕 Creating new test user...');
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        roleId: role.id,
        employee: {
          create: {
            employeeCode: 'BDAY-TEST',
            firstName: 'Birthday',
            lastName: 'Tester',
            dateOfBirth: dob,
            joiningDate: new Date(),
            departmentId: dept.id,
            employmentStatus: 'ACTIVE'
          }
        }
      }
    });
  }

  console.log('\n✨ Test user ready!');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
