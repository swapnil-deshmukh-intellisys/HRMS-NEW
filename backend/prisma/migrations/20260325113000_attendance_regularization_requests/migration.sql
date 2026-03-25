CREATE TYPE "AttendanceRegularizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "AttendanceRegularizationRequest" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL,
  "proposedCheckInTime" TIMESTAMP(3),
  "proposedCheckOutTime" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "AttendanceRegularizationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRegularizationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceRegularizationRequest_employeeId_idx" ON "AttendanceRegularizationRequest"("employeeId");
CREATE INDEX "AttendanceRegularizationRequest_status_idx" ON "AttendanceRegularizationRequest"("status");

ALTER TABLE "AttendanceRegularizationRequest"
ADD CONSTRAINT "AttendanceRegularizationRequest_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRegularizationRequest"
ADD CONSTRAINT "AttendanceRegularizationRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
