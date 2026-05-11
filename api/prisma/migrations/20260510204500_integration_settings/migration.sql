-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL,
    "orthanc_use_tls" BOOLEAN NOT NULL DEFAULT false,
    "orthanc_host" TEXT,
    "orthanc_port" INTEGER NOT NULL DEFAULT 8042,
    "orthanc_dicom_web_path" TEXT NOT NULL DEFAULT '/dicom-web',
    "orthanc_username" TEXT,
    "orthanc_password" TEXT,
    "web_origin_public" TEXT,
    "laudo_manufacturer" TEXT,
    "laudo_series_number" TEXT,
    "dicom_proxy_debug" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "integration_settings" ("id") VALUES ('default');
