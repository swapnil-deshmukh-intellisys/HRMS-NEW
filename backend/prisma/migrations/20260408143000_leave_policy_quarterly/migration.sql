CREATE TYPE "LeaveAllocationMode" AS ENUM ('YEARLY', 'QUARTERLY');

ALTER TABLE "LeaveType"
ADD COLUMN "allocationMode" "LeaveAllocationMode" NOT NULL DEFAULT 'YEARLY',
ADD COLUMN "quarterlyAllocationDays" DOUBLE PRECISION,
ADD COLUMN "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "carryForwardCap" DOUBLE PRECISION,
ADD COLUMN "requiresAttachmentAfterDays" DOUBLE PRECISION,
ADD COLUMN "deductFullQuotaOnApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxUsagesPerYear" INTEGER,
ADD COLUMN "policyEffectiveFromYear" INTEGER;

ALTER TABLE "LeaveBalance"
ADD COLUMN "visibleDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "carryForwardDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastQuarterProcessed" INTEGER;

ALTER TABLE "LeaveRequest"
ADD COLUMN "deductedDays" DOUBLE PRECISION,
ADD COLUMN "fullQuotaDeducted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "LeaveBalance"
SET "visibleDays" = "remainingDays";

UPDATE "LeaveType"
SET
  "defaultDaysPerYear" = 12,
  "allocationMode" = 'QUARTERLY',
  "quarterlyAllocationDays" = 3,
  "carryForwardAllowed" = false,
  "carryForwardCap" = NULL,
  "requiresAttachmentAfterDays" = NULL,
  "deductFullQuotaOnApproval" = false,
  "maxUsagesPerYear" = NULL,
  "policyEffectiveFromYear" = 2026
WHERE "code" = 'CL';

UPDATE "LeaveType"
SET
  "defaultDaysPerYear" = 8,
  "allocationMode" = 'QUARTERLY',
  "quarterlyAllocationDays" = 2,
  "carryForwardAllowed" = true,
  "carryForwardCap" = 15,
  "requiresAttachmentAfterDays" = 2,
  "deductFullQuotaOnApproval" = false,
  "maxUsagesPerYear" = NULL,
  "policyEffectiveFromYear" = 2026
WHERE "code" = 'SL';

UPDATE "LeaveType"
SET
  "defaultDaysPerYear" = 90,
  "allocationMode" = 'YEARLY',
  "quarterlyAllocationDays" = NULL,
  "carryForwardAllowed" = false,
  "carryForwardCap" = NULL,
  "requiresAttachmentAfterDays" = NULL,
  "deductFullQuotaOnApproval" = true,
  "maxUsagesPerYear" = 1,
  "policyEffectiveFromYear" = 2026,
  "isActive" = true
WHERE "name" = 'Maternity Leave';

UPDATE "LeaveType"
SET
  "defaultDaysPerYear" = 10,
  "allocationMode" = 'YEARLY',
  "quarterlyAllocationDays" = NULL,
  "carryForwardAllowed" = false,
  "carryForwardCap" = NULL,
  "requiresAttachmentAfterDays" = NULL,
  "deductFullQuotaOnApproval" = true,
  "maxUsagesPerYear" = 1,
  "policyEffectiveFromYear" = 2026,
  "isActive" = true
WHERE "name" = 'Paternity Leave';

UPDATE "LeaveType"
SET
  "defaultDaysPerYear" = 5,
  "allocationMode" = 'YEARLY',
  "quarterlyAllocationDays" = NULL,
  "carryForwardAllowed" = false,
  "carryForwardCap" = NULL,
  "requiresAttachmentAfterDays" = NULL,
  "deductFullQuotaOnApproval" = true,
  "maxUsagesPerYear" = 1,
  "policyEffectiveFromYear" = 2026,
  "isActive" = true
WHERE "name" = 'Bereavement Leave';

INSERT INTO "LeaveType" (
  "name",
  "code",
  "defaultDaysPerYear",
  "allocationMode",
  "quarterlyAllocationDays",
  "carryForwardAllowed",
  "carryForwardCap",
  "requiresAttachmentAfterDays",
  "deductFullQuotaOnApproval",
  "maxUsagesPerYear",
  "policyEffectiveFromYear",
  "isActive",
  "createdAt"
)
SELECT 'Maternity Leave', 'MAT', 90, 'YEARLY', NULL, false, NULL, NULL, true, 1, 2026, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LeaveType" WHERE "name" = 'Maternity Leave');

INSERT INTO "LeaveType" (
  "name",
  "code",
  "defaultDaysPerYear",
  "allocationMode",
  "quarterlyAllocationDays",
  "carryForwardAllowed",
  "carryForwardCap",
  "requiresAttachmentAfterDays",
  "deductFullQuotaOnApproval",
  "maxUsagesPerYear",
  "policyEffectiveFromYear",
  "isActive",
  "createdAt"
)
SELECT 'Paternity Leave', 'PAT', 10, 'YEARLY', NULL, false, NULL, NULL, true, 1, 2026, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LeaveType" WHERE "name" = 'Paternity Leave');

INSERT INTO "LeaveType" (
  "name",
  "code",
  "defaultDaysPerYear",
  "allocationMode",
  "quarterlyAllocationDays",
  "carryForwardAllowed",
  "carryForwardCap",
  "requiresAttachmentAfterDays",
  "deductFullQuotaOnApproval",
  "maxUsagesPerYear",
  "policyEffectiveFromYear",
  "isActive",
  "createdAt"
)
SELECT 'Bereavement Leave', 'BRV', 5, 'YEARLY', NULL, false, NULL, NULL, true, 1, 2026, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "LeaveType" WHERE "name" = 'Bereavement Leave');
