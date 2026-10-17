import {afterAll,describe,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {PrismaRoomRepository} from '../src/prismaRepository';
import {RoomService} from '../src/service';
import {canPlaceSetupSettlement} from '../../src/rules/settlementRules';
import {openAuction} from '../../src/rules/auctionRules';

// Explicit opt-in: point TEST_DATABASE_URL at an already migrated test database.
describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL integration',()=>{
  const options={datasources:{db:{url:process.env.TEST_DATABASE_URL??'postgresql://unused:unused@localhost:5432/unused'}}};
  const first=new PrismaClient(options),second=new PrismaClient(options);
  const repo=new PrismaRoomRepository(first),otherRepo=new PrismaRoomRepository(second);
  const a=new RoomService(repo,()=>0.5),b=new RoomService(otherRepo,()=>0.5);
  const roomIds:string[]=[];
  afterAll(async()=>{
    // Only delete rooms created by this test; never reset the database/schema.
    for(const id of roomIds)await first.gameRoom.delete({where:{id}});
    await Promise.all([first.$disconnect(),second.$disconnect()]);
  },30_000);
  it('enforces FKs, room capacity, transactional rollback, CAS, idempotency and durable private state',async()=>{
    const host=await a.create({displayName:'Integration host',companyId:0});
    roomIds.push(host.room.id);
    const code=host.room.roomCode;
    const joinedSecond=await a.join(code,{displayName:'Second',companyId:1});
    await expect(b.join(code,{displayName:'Duplicate',companyId:1})).rejects.toMatchObject({code:'COMPANY_TAKEN'});
    const third=await a.join(code,{displayName:'Third',companyId:2});
    const joins=await Promise.allSettled([a.join(code,{displayName:'Fourth A',companyId:3}),b.join(code,{displayName:'Fourth B',companyId:3})]);
    expect(joins.filter(j=>j.status==='fulfilled')).toHaveLength(1);
    const fourth=joins.find(j=>j.status==='fulfilled')!;
    if(fourth.status!=='fulfilled')throw new Error('No fourth player');
    const players=await first.roomPlayer.findMany({where:{roomId:host.room.id},orderBy:{seatIndex:'asc'}});
    expect(players).toHaveLength(4);
    await expect(first.roomPlayer.create({data:{roomId:host.room.id,displayName:'Illegal seat',companyId:7,seatIndex:9,reconnectTokenHash:'test-illegal'}})).rejects.toThrow();
    await expect(first.gameAction.create({data:{roomId:host.room.id,playerId:'outside-player',actionType:'invalid',payload:{},idempotencyKey:'invalid',requestHash:'invalid',stateVersion:100}})).rejects.toThrow();
    await a.execute(code,host.reconnectToken,'integration-start',{expectedVersion:0,targetProfit:1000},true);
    // Rollback leaves both state and action log unchanged.
    await expect(repo.transact(code,room=>{room.version++;room.actions=[];throw new Error('rollback')})).rejects.toThrow('rollback');
    expect((await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}})).version).toBe(1);
    // Force a DB error after snapshot update to prove the complete write rolls back.
    await expect(repo.transact(code,room=>{
      room.version++;
      room.actions.push({id:'invalid-action',roomId:room.id,playerId:'outside-player',actionType:'test',payload:{},idempotencyKey:'rollback-key',requestHash:'test',stateVersion:room.version,createdAt:new Date()});
    })).rejects.toThrow();
    expect((await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}})).version).toBe(1);
    expect(await first.gameAction.count({where:{roomId:host.room.id}})).toBe(1);
    const tokens=[host.reconnectToken,joinedSecond.reconnectToken,third.reconnectToken,fourth.value.reconnectToken];
    for(let companyId=0;companyId<4;companyId++){
      const vertexId=await repo.transact(code,room=>room.state.board.vertices.find(v=>canPlaceSetupSettlement(room.state,companyId,v.id).ok)!.id);
      await a.execute(code,tokens[companyId],`integration-setup-${companyId}`,{expectedVersion:companyId+1,action:{type:'placeSetupSettlement',vertexId}});
    }
    const outcomes=await Promise.allSettled([
      a.execute(code,tokens[0],'integration-roll-a',{expectedVersion:5,action:{type:'ROLL_DICE'}}),
      b.execute(code,tokens[0],'integration-roll-b',{expectedVersion:5,action:{type:'ROLL_DICE'}})
    ]);
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.find(x=>x.status==='rejected')).toMatchObject({reason:{code:'STALE_STATE_VERSION'}});
    const winningKey=outcomes[0].status==='fulfilled'?'integration-roll-a':'integration-roll-b';
    const retry=await b.execute(code,tokens[0],winningKey,{expectedVersion:5,action:{type:'ROLL_DICE'}});
    expect(retry.replayed).toBe(true);
    expect(await first.gameAction.count({where:{roomId:host.room.id,actionType:'ROLL_DICE'}})).toBe(1);
    await repo.transact(code,room=>{room.state=openAuction({...room.state,round:3},3);room.version++});
    await a.execute(code,tokens[0],'integration-bid',{expectedVersion:7,action:{type:'SUBMIT_BID',amount:10}});
    expect(await first.auctionBid.count({where:{roomId:host.room.id}})).toBe(1);
    await first.$disconnect();
    const restarted=new RoomService(new PrismaRoomRepository(second));
    const own=await restarted.get(code,tokens[0],true),opponent=await restarted.get(code,tokens[2],true);
    expect(own).toMatchObject({version:8,state:{auction:{sealedBids:[{amount:10}]}}});
    expect(opponent).toMatchObject({version:8,state:{auction:{sealedBids:[]}}});
  },120_000);
});
