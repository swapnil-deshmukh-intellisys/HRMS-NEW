ALTER TABLE "LeaveRequest"
ADD COLUMN "startDayDuration" "LeaveDurationType",
ADD COLUMN "endDayDuration" "LeaveDurationType";

UPDATE "LeaveRequest"
SET
  "startDayDuration" = "durationType",
  "endDayDuration" = "durationType";

ALTER TABLE "LeaveRequest"
ALTER COLUMN "startDayDuration" SET DEFAULT 'FULL_DAY',
ALTER COLUMN "startDayDuration" SET NOT NULL,
ALTER COLUMN "endDayDuration" SET DEFAULT 'FULL_DAY',
ALTER COLUMN "endDayDuration" SET NOT NULL;

ALTER TABLE "LeaveRequest"
DROP COLUMN "durationType";
