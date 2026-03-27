CREATE TYPE "CalendarExceptionType" AS ENUM ('HOLIDAY', 'WORKING_SATURDAY');

CREATE TABLE "CalendarException" (
  "id" SERIAL NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "type" "CalendarExceptionType" NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarException_date_key" ON "CalendarException"("date");
CREATE INDEX "CalendarException_date_idx" ON "CalendarException"("date");
CREATE INDEX "CalendarException_type_idx" ON "CalendarException"("type");
