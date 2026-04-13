-- CreateEnum
CREATE TYPE "MedicalProofStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_UPLOAD', 'PENDING_HR_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "medicalProofDueAt" TIMESTAMP(3),
ADD COLUMN     "medicalProofRejectionReason" TEXT,
ADD COLUMN     "medicalProofRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "medicalProofReviewedAt" TIMESTAMP(3),
ADD COLUMN     "medicalProofReviewedById" INTEGER,
ADD COLUMN     "medicalProofStatus" "MedicalProofStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "medicalProofSubmittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LeaveRequest_medicalProofStatus_idx" ON "LeaveRequest"("medicalProofStatus");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_medicalProofReviewedById_fkey" FOREIGN KEY ("medicalProofReviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
