-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "trackNumber" TEXT NOT NULL,
    "pdfPage" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "audioAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lesson_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dialogue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    CONSTRAINT "Dialogue_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DialogueLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dialogueId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reading" TEXT,
    "translationZh" TEXT,
    "translationEn" TEXT,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "note" TEXT,
    CONSTRAINT "DialogueLine_dialogueId_fkey" FOREIGN KEY ("dialogueId") REFERENCES "Dialogue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expression" TEXT NOT NULL,
    "reading" TEXT,
    "explanationZh" TEXT,
    "explanationJa" TEXT,
    "example" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "masteryLevel" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LessonExpression" (
    "lessonId" TEXT NOT NULL,
    "expressionId" TEXT NOT NULL,
    PRIMARY KEY ("lessonId", "expressionId"),
    CONSTRAINT "LessonExpression_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonExpression_expressionId_fkey" FOREIGN KEY ("expressionId") REFERENCES "Expression" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "dialogueId" TEXT,
    "lineId" TEXT,
    "mode" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "recordingPath" TEXT,
    "selfPronunciationScore" INTEGER,
    "selfRhythmScore" INTEGER,
    "selfFluencyScore" INTEGER,
    "startedWithinTarget" BOOLEAN,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PracticeSession_dialogueId_fkey" FOREIGN KEY ("dialogueId") REFERENCES "Dialogue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PracticeSession_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "DialogueLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "practiceSessionId" TEXT,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recording_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DictationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "accuracy" REAL NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "diffJson" TEXT NOT NULL,
    "addedToReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DictationAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DictationAttempt_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "DialogueLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonId" TEXT,
    "lineId" TEXT,
    "expressionId" TEXT,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME NOT NULL,
    "lastRating" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewItem_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "DialogueLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewItem_expressionId_fkey" FOREIGN KEY ("expressionId") REFERENCES "Expression" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyStudyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyDate" DATETIME NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "lessonCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "valueJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_number_key" ON "Unit"("number");
CREATE UNIQUE INDEX "Lesson_trackNumber_key" ON "Lesson"("trackNumber");
CREATE INDEX "Lesson_unitId_status_idx" ON "Lesson"("unitId", "status");
CREATE INDEX "Lesson_trackNumber_idx" ON "Lesson"("trackNumber");
CREATE UNIQUE INDEX "Lesson_unitId_sectionNumber_key" ON "Lesson"("unitId", "sectionNumber");
CREATE INDEX "Dialogue_lessonId_idx" ON "Dialogue"("lessonId");
CREATE UNIQUE INDEX "Dialogue_lessonId_number_key" ON "Dialogue"("lessonId", "number");
CREATE INDEX "DialogueLine_dialogueId_order_idx" ON "DialogueLine"("dialogueId", "order");
CREATE INDEX "DialogueLine_startMs_endMs_idx" ON "DialogueLine"("startMs", "endMs");
CREATE UNIQUE INDEX "DialogueLine_dialogueId_order_key" ON "DialogueLine"("dialogueId", "order");
CREATE INDEX "Expression_nextReviewAt_idx" ON "Expression"("nextReviewAt");
CREATE INDEX "Expression_favorite_idx" ON "Expression"("favorite");
CREATE UNIQUE INDEX "AudioAsset_storagePath_key" ON "AudioAsset"("storagePath");
CREATE INDEX "AudioAsset_filename_idx" ON "AudioAsset"("filename");
CREATE INDEX "PracticeSession_lessonId_startedAt_idx" ON "PracticeSession"("lessonId", "startedAt");
CREATE INDEX "PracticeSession_mode_startedAt_idx" ON "PracticeSession"("mode", "startedAt");
CREATE UNIQUE INDEX "Recording_storagePath_key" ON "Recording"("storagePath");
CREATE INDEX "Recording_practiceSessionId_idx" ON "Recording"("practiceSessionId");
CREATE INDEX "DictationAttempt_lessonId_createdAt_idx" ON "DictationAttempt"("lessonId", "createdAt");
CREATE INDEX "DictationAttempt_lineId_correct_idx" ON "DictationAttempt"("lineId", "correct");
CREATE INDEX "ReviewItem_nextReviewAt_idx" ON "ReviewItem"("nextReviewAt");
CREATE INDEX "ReviewItem_expressionId_idx" ON "ReviewItem"("expressionId");
CREATE UNIQUE INDEX "DailyStudyLog_studyDate_key" ON "DailyStudyLog"("studyDate");
CREATE INDEX "DailyStudyLog_studyDate_idx" ON "DailyStudyLog"("studyDate");
