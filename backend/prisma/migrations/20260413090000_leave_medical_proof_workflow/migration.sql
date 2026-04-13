CREATE TYPE "MedicalProofStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_UPLOAD', 'PENDING_HR_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

ALTER TABLE "LeaveRequest"
ADD COLUMN "medicalProofRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "medicalProofDueAt" TIMESTAMP(3),
ADD COLUMN "medicalProofSubmittedAt" TIMESTAMP(3),
ADD COLUMN "medicalProofStatus" "MedicalProofStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "medicalProofReviewedAt" TIMESTAMP(3),
ADD COLUMN "medicalProofReviewedById" INTEGER,
ADD COLUMN "medicalProofRejectionReason" TEXT;

CREATE INDEX "LeaveRequest_medicalProofStatus_idx" ON "LeaveRequest"("medicalProofStatus");

ALTER TABLE "LeaveRequest"
ADD CONSTRAINT "LeaveRequest_medicalProofReviewedById_fkey"
FOREIGN KEY ("medicalProofReviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
