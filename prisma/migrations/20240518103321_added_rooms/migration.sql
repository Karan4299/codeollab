/*
  Warnings:

  - You are about to drop the column `rooms` on the `Admins` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admins" DROP COLUMN "rooms";

-- CreateTable
CREATE TABLE "Rooms" (
    "id" SERIAL NOT NULL,
    "roomId" TEXT[],
    "adminId" INTEGER NOT NULL,

    CONSTRAINT "Rooms_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rooms" ADD CONSTRAINT "Rooms_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
