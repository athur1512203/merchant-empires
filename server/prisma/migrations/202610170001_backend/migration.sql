-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED');

-- CreateTable
CREATE TABLE "GameRoom" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "hostPlayerId" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "maxPlayers" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "reconnectTokenHash" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSnapshot" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "stateVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRoom_roomCode_key" ON "GameRoom"("roomCode");

-- CreateIndex
CREATE UNIQUE INDEX "GameRoom_hostPlayerId_key" ON "GameRoom"("hostPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRoom_id_hostPlayerId_key" ON "GameRoom"("id", "hostPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_reconnectTokenHash_key" ON "RoomPlayer"("reconnectTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_id_key" ON "RoomPlayer"("roomId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_companyId_key" ON "RoomPlayer"("roomId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_seatIndex_key" ON "RoomPlayer"("roomId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GameSnapshot_roomId_key" ON "GameSnapshot"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_roomId_playerId_idempotencyKey_key" ON "GameAction"("roomId", "playerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_roomId_stateVersion_key" ON "GameAction"("roomId", "stateVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionBid_roomId_auctionId_playerId_key" ON "AuctionBid"("roomId", "auctionId", "playerId");

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_id_hostPlayerId_fkey" FOREIGN KEY ("id", "hostPlayerId") REFERENCES "RoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSnapshot" ADD CONSTRAINT "GameSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_roomId_playerId_fkey" FOREIGN KEY ("roomId", "playerId") REFERENCES "RoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_roomId_playerId_fkey" FOREIGN KEY ("roomId", "playerId") REFERENCES "RoomPlayer"("roomId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Host belongs to the same room. Defer the circular reference during creation.
ALTER TABLE "GameRoom" ALTER CONSTRAINT "GameRoom_id_hostPlayerId_fkey" DEFERRABLE INITIALLY DEFERRED;
-- Four unique seats in [0,3] make capacity a database invariant too.
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_maxPlayers_check" CHECK ("maxPlayers" = 4);
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_seatIndex_check" CHECK ("seatIndex" BETWEEN 0 AND 3);
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_companyId_check" CHECK ("companyId" BETWEEN 0 AND 3);
ALTER TABLE "GameSnapshot" ADD CONSTRAINT "GameSnapshot_version_check" CHECK ("version" >= 0);
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_stateVersion_check" CHECK ("stateVersion" > 0);
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_amount_check" CHECK ("amount" > 0);
