import type { EmployeeCapabilityType, PrismaClient } from "@prisma/client";

export async function hasEmployeeCapability(
  prisma: PrismaClient,
  employeeId: number,
  capability: EmployeeCapabilityType,
) {
  const capabilityRecord = await prisma.employeeCapability.findUnique({
    where: {
      employeeId_capability: {
        employeeId,
        capability,
      },
    },
    select: { id: true },
  });

  return Boolean(capabilityRecord);
}

export async function getScopedEmployeeIdsForTeamLead(prisma: PrismaClient, employeeId: number) {
  const scope = await prisma.employeeTeamLeadScope.findMany({
    where: { teamLeaderId: employeeId },
    select: { employeeId: true },
  });

  return scope.map((entry) => entry.employeeId);
}

export async function canTeamLeadAccessEmployee(prisma: PrismaClient, teamLeaderId: number, employeeId: number) {
  const capability = await hasEmployeeCapability(prisma, teamLeaderId, "TEAM_LEAD");

  if (!capability) {
    return false;
  }

  const scopedEmployee = await prisma.employeeTeamLeadScope.findUnique({
    where: {
      teamLeaderId_employeeId: {
        teamLeaderId,
        employeeId,
      },
    },
    select: { id: true },
  });

  return Boolean(scopedEmployee);
}
