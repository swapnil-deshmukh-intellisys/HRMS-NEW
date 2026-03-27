-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "LeaveRequest"
ADD COLUMN "managerApprovalStatus" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "managerApprovedById" INTEGER,
ADD COLUMN "managerApprovedAt" TIMESTAMP(3),
ADD COLUMN "managerRejectionReason" TEXT,
ADD COLUMN "hrApprovalStatus" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "hrApprovedById" INTEGER,
ADD COLUMN "hrApprovedAt" TIMESTAMP(3),
ADD COLUMN "hrRejectionReason" TEXT;

-- Backfill existing leave requests into the new two-step model.
UPDATE "LeaveRequest"
SET
  "managerApprovalStatus" = CASE
    WHEN "status" = 'APPROVED' THEN 'APPROVED'::"ApprovalStepStatus"
    WHEN "status" = 'REJECTED' THEN 'APPROVED'::"ApprovalStepStatus"
    ELSE 'PENDING'::"ApprovalStepStatus"
  END,
  "managerApprovedAt" = CASE
    WHEN "status" IN ('APPROVED', 'REJECTED') THEN COALESCE("approvedAt", "updatedAt")
    ELSE NULL
  END,
  "hrApprovalStatus" = CASE
    WHEN "status" = 'APPROVED' THEN 'APPROVED'::"ApprovalStepStatus"
    WHEN "status" = 'REJECTED' THEN 'REJECTED'::"ApprovalStepStatus"
    ELSE 'PENDING'::"ApprovalStepStatus"
  END,
  "hrApprovedById" = CASE
    WHEN "status" IN ('APPROVED', 'REJECTED') THEN "approvedById"
    ELSE NULL
  END,
  "hrApprovedAt" = CASE
    WHEN "status" IN ('APPROVED', 'REJECTED') THEN "approvedAt"
    ELSE NULL
  END,
  "hrRejectionReason" = CASE
    WHEN "status" = 'REJECTED' THEN "rejectionReason"
    ELSE NULL
  END;

-- AddForeignKey
ALTER TABLE "LeaveRequest"
ADD CONSTRAINT "LeaveRequest_managerApprovedById_fkey"
FOREIGN KEY ("managerApprovedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest"
ADD CONSTRAINT "LeaveRequest_hrApprovedById_fkey"
FOREIGN KEY ("hrApprovedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "LeaveRequest"
DROP COLUMN "approvedById",
DROP COLUMN "approvedAt",
DROP COLUMN "rejectionReason";
