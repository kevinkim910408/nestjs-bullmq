-- CreateTable
CREATE TABLE "FreezedUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreezedUser_pkey" PRIMARY KEY ("id")
);
