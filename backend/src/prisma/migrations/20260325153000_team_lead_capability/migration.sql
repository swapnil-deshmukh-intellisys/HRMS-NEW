CREATE TYPE "EmployeeCapabilityType" AS ENUM ('TEAM_LEAD');

ALTER TABLE "Employee"
ADD COLUMN "jobTitle" TEXT;

CREATE TABLE "EmployeeCapability" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "capability" "EmployeeCapabilityType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeCapability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeTeamLeadScope" (
  "id" SERIAL NOT NULL,
  "teamLeaderId" INTEGER NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeTeamLeadScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeCapability_employeeId_capability_key" ON "EmployeeCapability"("employeeId", "capability");
CREATE INDEX "EmployeeCapability_employeeId_idx" ON "EmployeeCapability"("employeeId");

CREATE UNIQUE INDEX "EmployeeTeamLeadScope_teamLeaderId_employeeId_key" ON "EmployeeTeamLeadScope"("teamLeaderId", "employeeId");
CREATE INDEX "EmployeeTeamLeadScope_teamLeaderId_idx" ON "EmployeeTeamLeadScope"("teamLeaderId");
CREATE INDEX "EmployeeTeamLeadScope_employeeId_idx" ON "EmployeeTeamLeadScope"("employeeId");

ALTER TABLE "EmployeeCapability"
ADD CONSTRAINT "EmployeeCapability_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeTeamLeadScope"
ADD CONSTRAINT "EmployeeTeamLeadScope_teamLeaderId_fkey"
FOREIGN KEY ("teamLeaderId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeTeamLeadScope"
ADD CONSTRAINT "EmployeeTeamLeadScope_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
