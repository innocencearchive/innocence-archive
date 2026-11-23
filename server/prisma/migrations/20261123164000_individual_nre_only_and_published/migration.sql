-- Add nreOnly and isPublished visibility flags to individuals
ALTER TABLE "individuals" ADD COLUMN "nreOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "individuals" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "individuals_nreOnly_idx" ON "individuals"("nreOnly");
CREATE INDEX "individuals_isPublished_idx" ON "individuals"("isPublished");

-- Automatically flag & unpublish individuals whose ONLY provenance is the National Registry of Exonerations
-- (no media appearances, no news articles, at least one NRE source link, and zero non-NRE source links)
UPDATE "individuals" i
SET "nreOnly" = true,
    "isPublished" = false
WHERE NOT EXISTS (
  SELECT 1 FROM "_ItemFeaturingIndividuals" m WHERE m."A" = i.id
)
AND NOT EXISTS (
  SELECT 1 FROM "_NewsArticleIndividuals" n WHERE n."A" = i.id
)
AND EXISTS (
  SELECT 1
  FROM "individual_source_links" sl
  JOIN "information_sources" src ON src.id = sl."informationSourceId"
  WHERE sl."individualId" = i.id
    AND LOWER(src.name) = 'national registry of exonerations'
)
AND NOT EXISTS (
  SELECT 1
  FROM "individual_source_links" sl
  JOIN "information_sources" src ON src.id = sl."informationSourceId"
  WHERE sl."individualId" = i.id
    AND LOWER(src.name) <> 'national registry of exonerations'
);
