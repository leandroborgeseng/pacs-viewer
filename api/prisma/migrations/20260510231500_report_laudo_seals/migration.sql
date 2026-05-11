-- CreateTable
CREATE TABLE "report_laudo_seals" (
    "id" TEXT NOT NULL,
    "verify_code" VARCHAR(48) NOT NULL,
    "study_instance_uid" TEXT NOT NULL,
    "sop_instance_uid" TEXT NOT NULL,
    "issuer_user_id" TEXT NOT NULL,
    "issuer_email" TEXT NOT NULL,
    "canonical_payload" TEXT NOT NULL,
    "seal_mac_hex" VARCHAR(64) NOT NULL,
    "pdf_binary_sha256_hex" VARCHAR(64) NOT NULL,
    "orthanc_instance_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_laudo_seals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_laudo_seals_verify_code_key" ON "report_laudo_seals"("verify_code");

CREATE INDEX "report_laudo_seals_study_instance_uid_idx" ON "report_laudo_seals"("study_instance_uid");
