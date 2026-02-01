-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'viewer');

-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" BIGSERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "uid" TEXT NOT NULL,
    "eid" TEXT,
    "vid" TEXT,
    "registration_at" TIMESTAMP(3),
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "race" TEXT,
    "sex" TEXT,
    "color" TEXT,
    "mother_name" TEXT,
    "father_name" TEXT,
    "brand_mark" TEXT,
    "birth_year" INTEGER,
    "birth_month" INTEGER,
    "birth_place" TEXT,
    "diagnostic" TEXT,
    "warning" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HerdGroup" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HerdGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "unit" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_event" (
    "event_id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "event_at" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_subtype" TEXT,
    "source_ref" TEXT,
    "batch_id" TEXT,
    "confidence" DECIMAL(5,2),
    "notes" TEXT,
    "location_from_id" BIGINT,
    "location_to_id" BIGINT,
    "group_id" BIGINT,
    "party_id" BIGINT,
    "product_id" BIGINT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "weight_event" (
    "event_id" BIGINT NOT NULL,
    "weight_kg" DECIMAL(10,2),
    "method" TEXT,
    "shrink_pct" DECIMAL(5,2),

    CONSTRAINT "weight_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "movement_event" (
    "event_id" BIGINT NOT NULL,
    "reason" TEXT,
    "distance_km" DECIMAL(10,2),
    "transport_party_id" BIGINT,

    CONSTRAINT "movement_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "repro_event" (
    "event_id" BIGINT NOT NULL,
    "repro_action" TEXT,
    "sire_uid" TEXT,
    "dam_uid" TEXT,
    "result" TEXT,
    "calf_uid" TEXT,
    "gestation_days" INTEGER,

    CONSTRAINT "repro_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "health_event" (
    "event_id" BIGINT NOT NULL,
    "action" TEXT,
    "diagnosis" TEXT,
    "dose" DECIMAL(10,2),
    "dose_unit" TEXT,
    "withdrawal_days" INTEGER,

    CONSTRAINT "health_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "nutrition_event" (
    "event_id" BIGINT NOT NULL,
    "ration_code" TEXT,
    "intake_kg_day" DECIMAL(10,2),
    "supplement_code" TEXT,
    "reason" TEXT,

    CONSTRAINT "nutrition_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "cost_event" (
    "cost_id" BIGSERIAL NOT NULL,
    "cost_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "uid" TEXT,
    "group_id" BIGINT,
    "location_id" BIGINT,
    "category" TEXT NOT NULL,
    "product_id" BIGINT,
    "party_id" BIGINT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BOB',
    "quantity" DECIMAL(65,30),
    "unit" TEXT,
    "source_ref" TEXT,
    "batch_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" BIGINT,

    CONSTRAINT "cost_event_pkey" PRIMARY KEY ("cost_id")
);

-- CreateTable
CREATE TABLE "derived_metrics" (
    "id" BIGSERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "uid" TEXT,
    "data" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "derived_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HerdGroup_code_key" ON "HerdGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Party_code_key" ON "Party"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "animal_event_uid_event_at_idx" ON "animal_event"("uid", "event_at" DESC);

-- CreateIndex
CREATE INDEX "animal_event_event_type_event_at_idx" ON "animal_event"("event_type", "event_at" DESC);

-- CreateIndex
CREATE INDEX "animal_event_batch_id_idx" ON "animal_event"("batch_id");

-- CreateIndex
CREATE INDEX "animal_event_location_from_id_idx" ON "animal_event"("location_from_id");

-- CreateIndex
CREATE INDEX "animal_event_location_to_id_idx" ON "animal_event"("location_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_event_dedup" ON "animal_event"("uid", "event_at", "event_type", "event_subtype", "source_ref");

-- CreateIndex
CREATE INDEX "cost_event_scope_cost_at_idx" ON "cost_event"("scope", "cost_at" DESC);

-- CreateIndex
CREATE INDEX "cost_event_uid_cost_at_idx" ON "cost_event"("uid", "cost_at" DESC);

-- CreateIndex
CREATE INDEX "cost_event_category_cost_at_idx" ON "cost_event"("category", "cost_at" DESC);

-- CreateIndex
CREATE INDEX "cost_event_batch_id_idx" ON "cost_event"("batch_id");

-- CreateIndex
CREATE INDEX "derived_metrics_kind_idx" ON "derived_metrics"("kind");

-- CreateIndex
CREATE INDEX "derived_metrics_uid_idx" ON "derived_metrics"("uid");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_event" ADD CONSTRAINT "animal_event_uid_fkey" FOREIGN KEY ("uid") REFERENCES "Animal"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_event" ADD CONSTRAINT "animal_event_location_from_id_fkey" FOREIGN KEY ("location_from_id") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_event" ADD CONSTRAINT "animal_event_location_to_id_fkey" FOREIGN KEY ("location_to_id") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_event" ADD CONSTRAINT "animal_event_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "HerdGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_event" ADD CONSTRAINT "animal_event_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_event" ADD CONSTRAINT "animal_event_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_event" ADD CONSTRAINT "weight_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "animal_event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_event" ADD CONSTRAINT "movement_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "animal_event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_event" ADD CONSTRAINT "movement_event_transport_party_id_fkey" FOREIGN KEY ("transport_party_id") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repro_event" ADD CONSTRAINT "repro_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "animal_event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_event" ADD CONSTRAINT "health_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "animal_event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_event" ADD CONSTRAINT "nutrition_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "animal_event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_uid_fkey" FOREIGN KEY ("uid") REFERENCES "Animal"("uid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "HerdGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_event" ADD CONSTRAINT "cost_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "animal_event"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;
