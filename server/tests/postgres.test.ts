import {afterAll,describe,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {PrismaRoomRepository} from '../src/prismaRepository';
import {RoomService} from '../src/service';
import {canPlaceSetupSettlement} from '../../src/rules/settlementRules';
import {generateContract} from '../../src/rules/economyConfig';
import {CONSTRUCTION_RECIPES} from '../../src/rules/constructionProgression';
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
    for(let placement=0;placement<8;placement++){
      const companyId=placement%4;
      const vertexId=await repo.transact(code,room=>room.state.board.vertices.find(v=>canPlaceSetupSettlement(room.state,companyId,v.id).ok)!.id);
      await a.execute(code,tokens[companyId],`integration-setup-${placement}`,{expectedVersion:placement+1,action:{type:'placeSetupSettlement',vertexId}});
    }
    const outcomes=await Promise.allSettled([
      a.execute(code,tokens[0],'integration-roll-a',{expectedVersion:9,action:{type:'ROLL_DICE'}}),
      b.execute(code,tokens[0],'integration-roll-b',{expectedVersion:9,action:{type:'ROLL_DICE'}})
    ]);
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.find(x=>x.status==='rejected')).toMatchObject({reason:{code:'STALE_STATE_VERSION'}});
    const winningKey=outcomes[0].status==='fulfilled'?'integration-roll-a':'integration-roll-b';
    const retry=await b.execute(code,tokens[0],winningKey,{expectedVersion:9,action:{type:'ROLL_DICE'}});
    expect(retry.replayed).toBe(true);
    expect(await first.gameAction.count({where:{roomId:host.room.id,actionType:'ROLL_DICE'}})).toBe(1);
    await repo.transact(code,room=>{room.state=openAuction({...room.state,round:3},3);room.version++});
    await a.execute(code,tokens[0],'integration-bid',{expectedVersion:11,action:{type:'SUBMIT_BID',amount:10}});
    expect(await first.auctionBid.count({where:{roomId:host.room.id}})).toBe(1);
    await first.$disconnect();
    const restarted=new RoomService(new PrismaRoomRepository(second));
    const own=await restarted.get(code,tokens[0],true),opponent=await restarted.get(code,tokens[2],true);
    expect(own).toMatchObject({version:12,state:{auction:{sealedBids:[{amount:10}]}}});
    expect(opponent).toMatchObject({version:12,state:{auction:{sealedBids:[]}}});
  },120_000);

  it('persists sequential construction and legacy normalization without deleting snapshots',async()=>{
    const host=await a.create({displayName:'Construction regression',companyId:0});roomIds.push(host.room.id);
    const code=host.room.roomCode,guest=await a.join(code,{displayName:'Construction guest',companyId:3});
    await a.execute(code,host.reconnectToken,'construction-start',{expectedVersion:0,targetProfit:999999},true);
    for(const [who,token] of [[0,host.reconnectToken],[3,guest.reconnectToken],[0,host.reconnectToken],[3,guest.reconnectToken]] as const){
      const room=await repo.transact(code,r=>r);const vertexId=room.state.board.vertices.find(v=>canPlaceSetupSettlement(room.state,who,v.id).ok)!.id;
      await a.execute(code,token,'construction-setup-'+room.version,{expectedVersion:room.version,action:{type:'placeSetupSettlement',vertexId}});
    }
    await repo.transact(code,r=>{r.state.rolled=true;r.state.players[0]={...r.state.players[0],cash:10000,resources:{metal:100,wood:100,wheat:100,cotton:100}};r.version++});
    const home=(await repo.transact(code,r=>r.state.buildings[0])).vertexId;
    for(const [index,step] of CONSTRUCTION_RECIPES.slice(1).entries()){
      const version=await repo.transact(code,r=>r.version);
      if(index===0)await expect(a.execute(code,host.reconnectToken,'skip-factory-stage',{expectedVersion:version,action:{type:'BUILD_FACTORY',vertexId:home}})).rejects.toMatchObject({code:'ILLEGAL_ACTION'});
      await a.execute(code,host.reconnectToken,'construction-step-'+index,{expectedVersion:version,action:{type:step.type,vertexId:home}});
      const restored=await b.get(code,host.reconnectToken,true),stored=await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}});
      if(!('state' in restored))throw new Error('Missing state response');
      expect(restored.state.buildings[0]).toMatchObject({vertexId:home,level:2});
      expect((stored.state as unknown as {buildings:unknown[]}).buildings).toEqual(restored.state.buildings);
      expect(restored.state.factories).toHaveLength(index===0?0:1);
      if(index>0)expect(restored.state.factories[0].level).toBe(index);
      expect(restored.state.players[0].profit).toBe(0);
    }
    await repo.transact(code,r=>{delete r.state.constructionRulesVersion;(r.state.buildings[0] as unknown as {level:number}).level=3;r.version++});
    const raw=await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}});
    const view=await b.get(code,host.reconnectToken,true);
    if(!('state' in view))throw new Error('Missing state response');
    expect(view.state.buildings[0].level).toBe(2);expect(view.state).not.toHaveProperty('legacyConstruction');
    expect(await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}})).toEqual(raw);
    await a.execute(code,host.reconnectToken,'construction-legacy-end',{expectedVersion:view.version,action:{type:'END_TURN'}});
    const migrated=await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}});
    const state=migrated.state as unknown as {buildings:{level:number}[];legacyConstruction:{buildings:{level:number}[]}};
    expect(state.buildings[0].level).toBe(2);expect(state.legacyConstruction.buildings[0].level).toBe(3);
  },120_000);

  it('persists partial raw delivery basis and accepts legacy contracts without rewriting reads',async()=>{
    const host=await a.create({displayName:'Task08 accounting host',companyId:0});roomIds.push(host.room.id);
    const guest=await a.join(host.room.roomCode,{displayName:'Task08 accounting guest',companyId:1}),code=host.room.roomCode;
    await a.execute(code,host.reconnectToken,'task08-account-start',{expectedVersion:0,targetProfit:999999},true);
    await repo.transact(code,r=>{
      r.state.phase='playing';r.state.round=4;r.state.rolled=true;
      r.state.contracts=[{...generateContract(()=>0,3,1),status:'active',winnerId:0,winningBid:75,deadlineRound:6}];
      r.state.players[0].resources.metal=5;r.state.players[0].inventoryCost.metal=55;r.version++;
    });
    const version=await repo.transact(code,r=>r.version),id=await repo.transact(code,r=>r.state.contracts[0].id);
    await a.execute(code,host.reconnectToken,'task08-account-part',{expectedVersion:version,action:{type:'DELIVER_CONTRACT',contractId:id,quantity:2}});
    const saved=await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}});
    expect(saved.state).toMatchObject({contracts:[{delivered:2,deliveredCost:22,paid:false}],players:[{resources:{metal:3},inventoryCost:{metal:33},cash:0,revenue:0,costs:0,profit:0},{}]});
    const recovered=await b.get(code,host.reconnectToken,true);expect(recovered).toMatchObject({state:{contracts:[{deliveredCost:22}]}});
    expect(await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}})).toEqual(saved);
    await b.execute(code,host.reconnectToken,'task08-account-done',{expectedVersion:version+1,action:{type:'DELIVER_CONTRACT',contractId:id,quantity:3}});
    const done=await b.get(code,host.reconnectToken,true);
    expect(done).toMatchObject({state:{contracts:[{paid:true,deliveredCost:55}],players:[{cash:75,revenue:75,costs:55,profit:20,resources:{metal:0},inventoryCost:{metal:0}},{}]}});
    await repo.transact(code,r=>{delete r.state.contracts[0].deliveredCost;r.version++});
    const legacy=await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}});
    await a.get(code,guest.reconnectToken,true);
    expect(await first.gameSnapshot.findUniqueOrThrow({where:{roomId:host.room.id}})).toEqual(legacy);
  },120000);
});
