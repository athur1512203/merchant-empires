import {Prisma,PrismaClient} from '@prisma/client';
import {ApiError,type Room,type RoomRepository} from './domain';
import type {GameState} from '../../src/rules/types';
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export class PrismaRoomRepository implements RoomRepository {
  constructor(private db:PrismaClient){}
  async create(room:Room){
    await this.db.$transaction(async tx=>{
      // The circular host-membership FK is deferred until transaction commit.
      await tx.$executeRawUnsafe('SET CONSTRAINTS "GameRoom_id_hostPlayerId_fkey" DEFERRED');
      await tx.gameRoom.create({data:{id:room.id,roomCode:room.roomCode,hostPlayerId:room.hostPlayerId}});
      await tx.roomPlayer.createMany({data:room.players});
      await tx.gameSnapshot.create({data:{roomId:room.id,state:json(room.state)}});
    });
  }
  async transact<T>(code:string,work:(room:Room)=>T|Promise<T>):Promise<T>{
    return this.db.$transaction(async tx=>{
      // Database row lock covers joins, starts and actions across server processes.
      const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "GameRoom" WHERE "roomCode" = ${code} FOR UPDATE`;
      if(!rows.length)throw new ApiError(404,'ROOM_NOT_FOUND');
      const stored=await tx.gameRoom.findUniqueOrThrow({where:{id:rows[0].id},include:{players:{orderBy:{seatIndex:'asc'}},snapshot:true,actions:true,bids:true}});
      if(!stored.snapshot)throw new Error('Missing game snapshot');
      const {snapshot,...data}=stored;
      const room:Room={...data,state:snapshot.state as unknown as GameState,version:snapshot.version};
      const playerIds=new Set(room.players.map(p=>p.id)),actionIds=new Set(room.actions.map(a=>a.id)),bidIds=new Set(room.bids.map(b=>b.id));
      const result=await work(room);
      const players=room.players.filter(p=>!playerIds.has(p.id));
      if(players.length)await tx.roomPlayer.createMany({data:players});
      if(room.version!==snapshot.version){
        const changed=await tx.gameSnapshot.updateMany({where:{roomId:room.id,version:snapshot.version},data:{state:json(room.state),version:room.version}});
        if(changed.count!==1)throw new ApiError(409,'STALE_STATE_VERSION');
        await tx.gameRoom.update({where:{id:room.id},data:{status:room.status}});
      }else if(players.length)await tx.gameRoom.update({where:{id:room.id},data:{updatedAt:new Date()}});
      for(const action of room.actions.filter(a=>!actionIds.has(a.id)))await tx.gameAction.create({data:{...action,payload:json(action.payload)}});
      const bids=room.bids.filter(b=>!bidIds.has(b.id));
      if(bids.length)await tx.auctionBid.createMany({data:bids});
      return result;
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,maxWait:10_000,timeout:15_000});
  }
}
