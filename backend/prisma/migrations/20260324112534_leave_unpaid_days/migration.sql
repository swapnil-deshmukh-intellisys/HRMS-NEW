-- AlterTable
ALTER TABLE "LeaveRequest"
ADD COLUMN "isUnpaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paidDays" INTEGER,
ADD COLUMN "unpaidDays" INTEGER NOT NULL DEFAULT 0;

UPDATE "LeaveRequest"
SET "paidDays" = "totalDays",
    "unpaidDays" = 0,
    "isUnpaid" = false
WHERE "paidDays" IS NULL;

ALTER TABLE "LeaveRequest"
ALTER COLUMN "paidDays" SET NOT NULL;
