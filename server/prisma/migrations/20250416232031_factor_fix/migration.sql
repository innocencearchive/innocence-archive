-- CreateTable
CREATE TABLE "_FactorRelatedPersons" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FactorRelatedPersons_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FactorRelatedOrganizations" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FactorRelatedOrganizations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FactorRelatedPersons_B_index" ON "_FactorRelatedPersons"("B");

-- CreateIndex
CREATE INDEX "_FactorRelatedOrganizations_B_index" ON "_FactorRelatedOrganizations"("B");

-- AddForeignKey
ALTER TABLE "_FactorRelatedPersons" ADD CONSTRAINT "_FactorRelatedPersons_A_fkey" FOREIGN KEY ("A") REFERENCES "contributing_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FactorRelatedPersons" ADD CONSTRAINT "_FactorRelatedPersons_B_fkey" FOREIGN KEY ("B") REFERENCES "involved_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FactorRelatedOrganizations" ADD CONSTRAINT "_FactorRelatedOrganizations_A_fkey" FOREIGN KEY ("A") REFERENCES "contributing_factors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FactorRelatedOrganizations" ADD CONSTRAINT "_FactorRelatedOrganizations_B_fkey" FOREIGN KEY ("B") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
