import { PrismaClient, ApprovalStepStatus, LeaveStatus, LeaveDurationType, AttendanceStatus, MedicalProofStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employeeCode = 'IITS0012';
  const targetDate = new Date('2026-06-01T00:00:00.000Z');

  console.log(`Fetching employee Ritesh Jawale (Code: ${employeeCode})...`);
  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
    include: {
      leaveBalances: {
        include: { leaveType: true },
      },
    },
  });

  if (!employee) {
    console.error('Employee not found');
    return;
  }

  // Find CL leave type ID
  const clBalance = employee.leaveBalances.find((b) => b.leaveType.code === 'CL');
  if (!clBalance) {
    console.error('Casual Leave (CL) balance record not found for this employee.');
    return;
  }

  const leaveTypeId = clBalance.leaveTypeId;

  // Find a manager/HR employee for approval columns
  const hrEmployee = await prisma.employee.findFirst({
    where: { user: { role: { name: 'HR' } } },
  });
  
  const managerId = employee.managerId || null;
  const hrId = hrEmployee?.id || null;

  console.log(`Using CL Leave Type (ID: ${leaveTypeId})`);
  console.log(`Manager Approver ID: ${managerId}, HR Approver ID: ${hrId}`);

  // We perform all operations inside a transaction to keep the DB state consistent
  await prisma.$transaction(async (tx) => {
    // 1. Create the LeaveRequest record as APPROVED
    const leaveRequest = await tx.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveTypeId,
        startDate: targetDate,
        endDate: targetDate,
        totalDays: 0.5,
        reason: 'This is a test request for Casual Leave (CL) on June 1st, 2026, submitted for validation of normal system approval flow.',
        status: LeaveStatus.APPROVED,
        isUnpaid: false,
        paidDays: 0.5,
        unpaidDays: 0,
        startDayDuration: LeaveDurationType.HALF_DAY,
        endDayDuration: LeaveDurationType.HALF_DAY,
        managerApprovalStatus: managerId ? ApprovalStepStatus.APPROVED : ApprovalStepStatus.PENDING,
        managerApprovedById: managerId,
        managerApprovedAt: new Date(),
        hrApprovalStatus: hrId ? ApprovalStepStatus.APPROVED : ApprovalStepStatus.PENDING,
        hrApprovedById: hrId,
        hrApprovedAt: new Date(),
        deductedDays: 0.5,
        fullQuotaDeducted: false,
        medicalProofStatus: MedicalProofStatus.NOT_REQUIRED,
      },
    });

    console.log(`Created LeaveRequest ID: ${leaveRequest.id}`);

    // 2. Deduct leave balance
    const updatedBalance = await tx.leaveBalance.update({
      where: { id: clBalance.id },
      data: {
        usedDays: clBalance.usedDays + 0.5,
        remainingDays: clBalance.remainingDays - 0.5,
        visibleDays: Math.max(clBalance.visibleDays - 0.5, 0),
      },
    });

    console.log(`Updated Leave Balance for CL: remaining=${updatedBalance.remainingDays}, used=${updatedBalance.usedDays}`);

    // 3. Create/update the Attendance record for that day
    const existingAttendance = await tx.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate: targetDate,
        },
      },
    });

    if (existingAttendance) {
      const updatedAttendance = await tx.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: AttendanceStatus.HALF_DAY,
          checkInTime: null,
          checkOutTime: null,
          workedMinutes: 0,
        },
      });
      console.log(`Updated existing Attendance record (ID: ${updatedAttendance.id}) to HALF_DAY`);
    } else {
      const newAttendance = await tx.attendance.create({
        data: {
          employeeId: employee.id,
          attendanceDate: targetDate,
          status: AttendanceStatus.HALF_DAY,
          workedMinutes: 0,
        },
      });
      console.log(`Created new Attendance record (ID: ${newAttendance.id}) as HALF_DAY`);
    }
  });

  console.log('Database transaction successfully completed!');
}

main()
  .catch((e) => {
    console.error('Error executing script:', e);
  })
  .finally(() => prisma.$disconnect());
