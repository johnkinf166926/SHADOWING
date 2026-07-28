DROP INDEX "Lesson_unitId_sectionNumber_key";
CREATE INDEX "Lesson_unitId_sectionNumber_idx" ON "Lesson"("unitId", "sectionNumber");
