import { prisma } from "../config/prisma.js";

export type AuditEntity = "PayrollRecord" | "Employee" | "LeaveRequest";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export async function createAuditLog(params: {
  userId: number;
  action: AuditAction;
  entity: AuditEntity;
  entityId: number;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldData: params.oldData ?? undefined,
        newData: params.newData ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // We don't throw here to avoid failing the main transaction
  }
}
