-- CreateTable
CREATE TABLE "exonerees" (
    "id" SERIAL NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "age_at_crime" DOUBLE PRECISION,
    "race" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT,
    "worst_crime" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,
    "convicted_year" INTEGER NOT NULL,
    "exonerated_year" INTEGER NOT NULL,
    "posting_date" DATE NOT NULL,
    "date_of_crime_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exonerees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "tag_code" TEXT NOT NULL,
    "tag_name" TEXT NOT NULL,
    "tag_description" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributing_factors" (
    "exoneree_id" INTEGER NOT NULL,
    "dna_evidence" BOOLEAN NOT NULL DEFAULT false,
    "false_misleading_forensic_evidence" BOOLEAN NOT NULL DEFAULT false,
    "false_confession" BOOLEAN NOT NULL DEFAULT false,
    "inadequate_legal_defense" BOOLEAN NOT NULL DEFAULT false,
    "perjury_false_accusation" BOOLEAN NOT NULL DEFAULT false,
    "mistaken_witness_id" BOOLEAN NOT NULL DEFAULT false,
    "official_misconduct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contributing_factors_pkey" PRIMARY KEY ("exoneree_id")
);

-- CreateTable
CREATE TABLE "om_tags" (
    "id" SERIAL NOT NULL,
    "tag_code" TEXT NOT NULL,
    "tag_description" TEXT NOT NULL,

    CONSTRAINT "om_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crime_categories" (
    "id" SERIAL NOT NULL,
    "crime_name" TEXT NOT NULL,
    "severity_order" INTEGER NOT NULL,

    CONSTRAINT "crime_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExonereeTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ExonereeTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExonereeOmTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ExonereeOmTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "exonerees_last_name_idx" ON "exonerees"("last_name");

-- CreateIndex
CREATE INDEX "exonerees_race_idx" ON "exonerees"("race");

-- CreateIndex
CREATE INDEX "exonerees_state_idx" ON "exonerees"("state");

-- CreateIndex
CREATE INDEX "exonerees_worst_crime_idx" ON "exonerees"("worst_crime");

-- CreateIndex
CREATE INDEX "exonerees_convicted_year_idx" ON "exonerees"("convicted_year");

-- CreateIndex
CREATE INDEX "exonerees_exonerated_year_idx" ON "exonerees"("exonerated_year");

-- CreateIndex
CREATE UNIQUE INDEX "tags_tag_code_key" ON "tags"("tag_code");

-- CreateIndex
CREATE UNIQUE INDEX "om_tags_tag_code_key" ON "om_tags"("tag_code");

-- CreateIndex
CREATE UNIQUE INDEX "crime_categories_crime_name_key" ON "crime_categories"("crime_name");

-- CreateIndex
CREATE INDEX "_ExonereeTags_B_index" ON "_ExonereeTags"("B");

-- CreateIndex
CREATE INDEX "_ExonereeOmTags_B_index" ON "_ExonereeOmTags"("B");

-- AddForeignKey
ALTER TABLE "contributing_factors" ADD CONSTRAINT "contributing_factors_exoneree_id_fkey" FOREIGN KEY ("exoneree_id") REFERENCES "exonerees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExonereeTags" ADD CONSTRAINT "_ExonereeTags_A_fkey" FOREIGN KEY ("A") REFERENCES "exonerees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExonereeTags" ADD CONSTRAINT "_ExonereeTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExonereeOmTags" ADD CONSTRAINT "_ExonereeOmTags_A_fkey" FOREIGN KEY ("A") REFERENCES "exonerees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExonereeOmTags" ADD CONSTRAINT "_ExonereeOmTags_B_fkey" FOREIGN KEY ("B") REFERENCES "om_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
