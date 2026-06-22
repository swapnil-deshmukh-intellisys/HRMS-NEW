CREATE UNIQUE INDEX "AttendanceRegularizationRequest_unique_pending_idx" 
ON "AttendanceRegularizationRequest"("employeeId", "attendanceDate") 
WHERE "status" = 'PENDING';
