-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
-- Los usuarios que ya existieran antes de este cambio (normalmente, tu
-- propia cuenta de pruebas) quedan aprobados automáticamente para no
-- bloquearlos de golpe. Los que se registren a partir de ahora sí caen en
-- PENDING por defecto (se cambia el default justo después de rellenar).
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);

-- El usuario más antiguo (normalmente, el primero que se registró, o sea
-- tú) pasa a ser administrador automáticamente.
UPDATE "User"
SET "role" = 'ADMIN', "approvedAt" = NOW()
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
