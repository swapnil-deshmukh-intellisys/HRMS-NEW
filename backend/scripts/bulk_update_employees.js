import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const data = [
  { email: 'ritesh.intellisys@gmail.com', dob: '13/11/1997', doj: '07/11/2024', pan: null },
  { email: 'rahuljadhav.intellisys@gmail.com', dob: '15/03/2000', doj: '9/8/2025', pan: 'CHVPJ1029C' },
  { email: 'rushikeshbhaganagare.intellisys@gmail.com', dob: '02/04/1998', doj: '9/2/2026', pan: null },
  { email: 'nikita.intellisys@gmail.com', dob: '17/11/1998', doj: '16/01/2026', pan: 'CULPR3075F' },
  { email: 'dhanashree.intellisys@gmail.com', dob: '27/03/2000', doj: '02/04/2026', pan: 'BZPPN9525C' },
  { email: 'akshaymore.intellisys@gmail.com', dob: '19/02/2000', doj: '07/11/2024', pan: 'FQPPM2787G' },
  { email: 'priyankakamble.intellisys@gmail.com', dob: '10/02/2002', doj: '12/01/2026', pan: null },
  { email: 'gaurav.intellisys@gmail.com', dob: '29/01/1998', doj: '10/3/2026', pan: 'DBJPR0872L' },
  { email: 'drushtibothikar.intellisys@gmail.com', dob: '21/05/2001', doj: '06/04/2026', pan: 'EPDPB4518C' },
  { email: 'adeshrasal.intellisys@gmail.com', dob: '28/10/1999', doj: '04/12/2024', pan: 'EKIPR8623G' },
  { email: 'gayatri.intellisys@gmail.com', dob: '12/11/2003', doj: '16/01/2026', pan: null },
  { email: 'harshada.intellisys@gmail.com', dob: '27/5/2001', doj: '24/8/2024', pan: 'CHFPN0804D' },
  { email: 'vaishnavic.intellisys@gmail.com', dob: '27/9/2000', doj: '13/1/2026', pan: null },
  { email: 'priyanka.intellisys@gmail.com', dob: '12/3/2001', doj: '7/11/2024', pan: 'OTUPS9498M' },
  { email: 'surajmolke.intellisys@gmail.com', dob: '22/02/1997', doj: '09/02/2026', pan: null },
];

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  // Using UTC to avoid local timezone shifts during database save
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
};

async function main() {
  console.log('🚀 Starting bulk employee update...');
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const item of data) {
    const user = await prisma.user.findUnique({
      where: { email: item.email },
      include: { employee: true }
    });

    if (user && user.employee) {
      await prisma.employee.update({
        where: { id: user.employee.id },
        data: {
          dateOfBirth: parseDate(item.dob),
          joiningDate: parseDate(item.doj),
          panCardNumber: item.pan || null
        }
      });
      console.log(`✅ Updated: ${item.email}`);
      updatedCount++;
    } else {
      console.log(`⚠️ User not found: ${item.email}`);
      skippedCount++;
    }
  }
  
  console.log('\n✨ Bulk update completed!');
  console.log(`📊 Summary: ${updatedCount} updated, ${skippedCount} skipped.`);
}

main()
  .catch((e) => {
    console.error('❌ Error during update:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
