-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifySms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crse" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeats" INTEGER,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSnapshot" (
    "id" TEXT NOT NULL,
    "crse" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "seatsAvailable" INTEGER NOT NULL,
    "enrollmentLimit" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LoginCode_userId_idx" ON "LoginCode"("userId");

-- CreateIndex
CREATE INDEX "Watch_crse_term_idx" ON "Watch"("crse", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_userId_crse_term_sectionLabel_key" ON "Watch"("userId", "crse", "term", "sectionLabel");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSnapshot_crse_term_sectionLabel_key" ON "CourseSnapshot"("crse", "term", "sectionLabel");

-- AddForeignKey
ALTER TABLE "LoginCode" ADD CONSTRAINT "LoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
