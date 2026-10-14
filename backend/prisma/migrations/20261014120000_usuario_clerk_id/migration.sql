-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "clerk_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "usuario_clerk_id_key" ON "usuario"("clerk_id");

