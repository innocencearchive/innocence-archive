-- CreateEnum
CREATE TYPE "ContributingFactorCode" AS ENUM (
  'FALSE_CONFESSION',
  'OFFICIAL_MISCONDUCT',
  'POLICE_MISCONDUCT',
  'PROSECUTORIAL_MISCONDUCT',
  'WITHHELD_EXCULPATORY_EVIDENCE',
  'MISTAKEN_EYEWITNESS_IDENTIFICATION',
  'PERJURY_OR_FALSE_ACCUSATION',
  'FALSE_OR_MISLEADING_FORENSIC_EVIDENCE',
  'INADEQUATE_LEGAL_DEFENSE',
  'JAILHOUSE_INFORMANT',
  'TUNNEL_VISION_RUSH_TO_JUDGMENT',
  'RACIAL_BIAS',
  'PREJUDICIAL_JOINDER_JOINT_TRIAL',
  'MEDIA_SENSATIONALISM',
  'COERCED_PLEA',
  'UNRELIABLE_WITNESS'
);

-- Clear unstandardized legacy free-text rows before enforcing enum code NOT NULL
DELETE FROM "contributing_factors";

-- AlterTable
ALTER TABLE "contributing_factors" ADD COLUMN "code" "ContributingFactorCode" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "contributing_factors_code_key" ON "contributing_factors"("code");

-- Seed all 16 standardized ContributingFactor enum rows
INSERT INTO "contributing_factors" ("code", "name", "aiGenerated", "verificationStatus", "createdAt", "updatedAt")
VALUES
  ('FALSE_CONFESSION', 'False Confession', false, 'VERIFIED', NOW(), NOW()),
  ('OFFICIAL_MISCONDUCT', 'Official Misconduct', false, 'VERIFIED', NOW(), NOW()),
  ('POLICE_MISCONDUCT', 'Police Misconduct', false, 'VERIFIED', NOW(), NOW()),
  ('PROSECUTORIAL_MISCONDUCT', 'Prosecutorial Misconduct', false, 'VERIFIED', NOW(), NOW()),
  ('WITHHELD_EXCULPATORY_EVIDENCE', 'Withheld Exculpatory Evidence (Brady Violation)', false, 'VERIFIED', NOW(), NOW()),
  ('MISTAKEN_EYEWITNESS_IDENTIFICATION', 'Mistaken Eyewitness Identification', false, 'VERIFIED', NOW(), NOW()),
  ('PERJURY_OR_FALSE_ACCUSATION', 'Perjury or False Accusation', false, 'VERIFIED', NOW(), NOW()),
  ('FALSE_OR_MISLEADING_FORENSIC_EVIDENCE', 'False or Misleading Forensic Evidence', false, 'VERIFIED', NOW(), NOW()),
  ('INADEQUATE_LEGAL_DEFENSE', 'Inadequate Legal Defense', false, 'VERIFIED', NOW(), NOW()),
  ('JAILHOUSE_INFORMANT', 'Jailhouse Informant', false, 'VERIFIED', NOW(), NOW()),
  ('TUNNEL_VISION_RUSH_TO_JUDGMENT', 'Tunnel Vision / Rush to Judgment', false, 'VERIFIED', NOW(), NOW()),
  ('RACIAL_BIAS', 'Racial Bias', false, 'VERIFIED', NOW(), NOW()),
  ('PREJUDICIAL_JOINDER_JOINT_TRIAL', 'Prejudicial Joinder / Joint Trial', false, 'VERIFIED', NOW(), NOW()),
  ('MEDIA_SENSATIONALISM', 'Media Sensationalism', false, 'VERIFIED', NOW(), NOW()),
  ('COERCED_PLEA', 'Coerced Plea', false, 'VERIFIED', NOW(), NOW()),
  ('UNRELIABLE_WITNESS', 'Unreliable Witness', false, 'VERIFIED', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
