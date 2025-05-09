-- CreateTable
CREATE TABLE "_RelatedIndividuals" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RelatedIndividuals_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RelatedIndividuals_B_index" ON "_RelatedIndividuals"("B");

-- AddForeignKey
ALTER TABLE "_RelatedIndividuals" ADD CONSTRAINT "_RelatedIndividuals_A_fkey" FOREIGN KEY ("A") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedIndividuals" ADD CONSTRAINT "_RelatedIndividuals_B_fkey" FOREIGN KEY ("B") REFERENCES "individuals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
