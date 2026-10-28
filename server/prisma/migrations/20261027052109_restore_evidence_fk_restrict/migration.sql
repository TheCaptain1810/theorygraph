-- DropForeignKey
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_counter_reading_id_fkey";

-- DropForeignKey
ALTER TABLE "evidence" DROP CONSTRAINT "evidence_interpretation_id_fkey";

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_interpretation_id_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "interpretations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_counter_reading_id_fkey" FOREIGN KEY ("counter_reading_id") REFERENCES "counter_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
