-- CreateEnum
CREATE TYPE "InterpretationType" AS ENUM ('interpretation', 'fan_theory', 'production_fact', 'question');

-- CreateEnum
CREATE TYPE "SpoilerLevel" AS ENUM ('none', 'minor', 'major');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('published', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('observation', 'external_source', 'production_fact');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('motif', 'cinematography', 'editing', 'sound', 'narrative', 'theme', 'genre', 'other');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'moderator', 'admin');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "films" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_film_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "release_year" INTEGER,
    "director" TEXT,
    "poster_path" TEXT,
    "metadata_attribution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "films_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpretations" (
    "id" UUID NOT NULL,
    "film_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "interpretation_type" "InterpretationType" NOT NULL,
    "spoiler_level" "SpoilerLevel" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interpretations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_readings" (
    "id" UUID NOT NULL,
    "interpretation_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "interpretation_id" UUID,
    "counter_reading_id" UUID,
    "scene_description" TEXT,
    "timestamp_seconds" INTEGER,
    "evidence_type" "EvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL DEFAULT 'other',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpretation_tags" (
    "interpretation_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "interpretation_tags_pkey" PRIMARY KEY ("interpretation_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "films_provider_provider_film_id_key" ON "films"("provider", "provider_film_id");

-- CreateIndex
CREATE INDEX "interpretations_film_id_status_created_at_idx" ON "interpretations"("film_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "interpretations_author_id_idx" ON "interpretations"("author_id");

-- CreateIndex
CREATE INDEX "counter_readings_interpretation_id_status_created_at_idx" ON "counter_readings"("interpretation_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "evidence_interpretation_id_idx" ON "evidence"("interpretation_id");

-- CreateIndex
CREATE INDEX "evidence_counter_reading_id_idx" ON "evidence"("counter_reading_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- AddForeignKey
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_film_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_readings" ADD CONSTRAINT "counter_readings_interpretation_id_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "interpretations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_readings" ADD CONSTRAINT "counter_readings_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_interpretation_id_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "interpretations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_counter_reading_id_fkey" FOREIGN KEY ("counter_reading_id") REFERENCES "counter_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpretation_tags" ADD CONSTRAINT "interpretation_tags_interpretation_id_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "interpretations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpretation_tags" ADD CONSTRAINT "interpretation_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints (not expressible in schema.prisma; see DATA_MODEL.md "Key constraints")

-- Evidence belongs to exactly one parent: an interpretation XOR a counter-reading.
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_exactly_one_parent_chk"
    CHECK (("interpretation_id" IS NOT NULL)::int + ("counter_reading_id" IS NOT NULL)::int = 1);

-- Timestamps cannot be negative.
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_timestamp_non_negative_chk"
    CHECK ("timestamp_seconds" IS NULL OR "timestamp_seconds" >= 0);

-- Release year sanity.
ALTER TABLE "films" ADD CONSTRAINT "films_release_year_chk"
    CHECK ("release_year" IS NULL OR "release_year" BETWEEN 1850 AND 2200);
