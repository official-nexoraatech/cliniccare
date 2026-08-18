-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN "attendedOn" DATETIME;
ALTER TABLE "FollowUp" ADD COLUMN "attendedVisitId" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "contactMode" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "contactResult" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "contactedBy" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "contactedOn" DATETIME;
ALTER TABLE "FollowUp" ADD COLUMN "purpose" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "remark" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "rescheduledTo" DATETIME;
