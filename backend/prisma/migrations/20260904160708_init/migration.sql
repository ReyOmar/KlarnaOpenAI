-- CreateEnum
CREATE TYPE "EstadoConversacion" AS ENUM ('ACTIVA', 'CERRADA', 'HANDOFF');

-- CreateEnum
CREATE TYPE "Remitente" AS ENUM ('USUARIO', 'ASISTENTE', 'AGENTE_HUMANO');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('BAJO', 'CRITICO', 'AGOTADO');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ACTIVA', 'RESUELTA', 'IGNORADA');

-- CreateEnum
CREATE TYPE "EstadoHandoff" AS ENUM ('PENDIENTE', 'ASIGNADO', 'RESUELTO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversacion" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoConversacion" NOT NULL DEFAULT 'ACTIVA',

    CONSTRAINT "conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensaje" (
    "id" SERIAL NOT NULL,
    "id_conversacion" INTEGER NOT NULL,
    "id_modelo" INTEGER,
    "remitente" "Remitente" NOT NULL,
    "contenido" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo_ia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_api" TEXT NOT NULL,
    "costo_entrada_musd" DOUBLE PRECISION NOT NULL,
    "costo_salida_musd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "modelo_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumo_api" (
    "id" SERIAL NOT NULL,
    "id_mensaje" INTEGER NOT NULL,
    "id_modelo" INTEGER NOT NULL,
    "tokens_entrada" INTEGER NOT NULL,
    "tokens_salida" INTEGER NOT NULL,
    "costo_usd" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumo_api_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldo_diario" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "saldo_c_t" DOUBLE PRECISION NOT NULL,
    "recarga_r" DOUBLE PRECISION NOT NULL,
    "consumo_u" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "saldo_diario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" SERIAL NOT NULL,
    "id_saldo" INTEGER NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "umbral_usd" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ACTIVA',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoff" (
    "id" SERIAL NOT NULL,
    "id_conversacion" INTEGER NOT NULL,
    "id_agente" INTEGER,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoHandoff" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" SERIAL NOT NULL,
    "presupuesto_mensual" DOUBLE PRECISION NOT NULL,
    "umbral_alerta" DOUBLE PRECISION NOT NULL,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_ia_nombre_key" ON "modelo_ia"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_api_id_mensaje_key" ON "consumo_api"("id_mensaje");

-- CreateIndex
CREATE UNIQUE INDEX "saldo_diario_fecha_key" ON "saldo_diario"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "agente_email_key" ON "agente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "handoff_id_conversacion_key" ON "handoff"("id_conversacion");

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_id_modelo_fkey" FOREIGN KEY ("id_modelo") REFERENCES "modelo_ia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_api" ADD CONSTRAINT "consumo_api_id_mensaje_fkey" FOREIGN KEY ("id_mensaje") REFERENCES "mensaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_api" ADD CONSTRAINT "consumo_api_id_modelo_fkey" FOREIGN KEY ("id_modelo") REFERENCES "modelo_ia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_saldo_fkey" FOREIGN KEY ("id_saldo") REFERENCES "saldo_diario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_id_agente_fkey" FOREIGN KEY ("id_agente") REFERENCES "agente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
