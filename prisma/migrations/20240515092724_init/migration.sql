-- CreateTable
CREATE TABLE "Admins" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rooms" INTEGER[],

    CONSTRAINT "Admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admins_username_key" ON "Admins"("username");
