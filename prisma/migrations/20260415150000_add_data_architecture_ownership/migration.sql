-- AlterTable: extend DataDomain with steward
ALTER TABLE "data_domains" ADD COLUMN "stewardId" TEXT;

-- AlterTable: extend DataEntity with business owner + custodian
ALTER TABLE "data_entities" ADD COLUMN "businessOwnerId" TEXT;
ALTER TABLE "data_entities" ADD COLUMN "custodianId" TEXT;

-- AddForeignKey: DataDomain.steward -> users
ALTER TABLE "data_domains"
  ADD CONSTRAINT "data_domains_stewardId_fkey"
  FOREIGN KEY ("stewardId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DataEntity.businessOwner -> users
ALTER TABLE "data_entities"
  ADD CONSTRAINT "data_entities_businessOwnerId_fkey"
  FOREIGN KEY ("businessOwnerId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DataEntity.custodian -> users
ALTER TABLE "data_entities"
  ADD CONSTRAINT "data_entities_custodianId_fkey"
  FOREIGN KEY ("custodianId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
