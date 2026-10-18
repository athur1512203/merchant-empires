import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {createApp} from '../src/app';
import {RoomService} from '../src/service';
import {MemoryRepository} from './memoryRepository';
import {canPlaceSetupSettlement} from '../../src/rules/settlementRules';
import {openAuction} from '../../src/rules/auctionRules';

async function fixture(companies=[0,1,2,3]){
  const repo=new MemoryRepository(),service=new RoomService(repo,()=>0.25),app=createApp(service);
  const host=await request(app).post('/api/rooms').send({displayName:'Host',companyId:companies[0]}).expect(201);
  const code=host.body.room.roomCode,players=[host.body];
  for(const companyId of companies.slice(1))players.push((await request(app).post(`/api/rooms/${code}/join`).send({displayName:`P${companyId}`,companyId}).expect(201)).body);
  const base=`/api/rooms/${code}`;
  const start=(who=0,key='start-key-001',expectedVersion=0)=>request(app).post(`${base}/start`).auth(players[who].reconnectToken,{type:'bearer'}).set('Idempotency-Key',key).send({expectedVersion,targetProfit:1000});
  const act=(who:number,action:unknown,expectedVersion:number,key=`action-${expectedVersion}`)=>request(app).post(`${base}/actions`).auth(players[who].reconnectToken,{type:'bearer'}).set('Idempotency-Key',key).send({expectedVersion,action});
  return {repo,service,app,code,base,players,start,act};
}
async function playing(){
  const f=await fixture();await f.start().expect(200);
  for(let who=0;who<8;who++){
    const s=f.repo.rooms.get(f.code)!.state;
    const vertexId=s.board.vertices.find(v=>canPlaceSetupSettlement(s,who%4,v.id).ok)!.id;
    await f.act(who%4,{type:'placeSetupSettlement',vertexId},who+1).expect(200);
  }
  return f;
}
describe('room API',()=>{
  it('serializes duplicate setup requests and reserves the vertex on the backend',async()=>{
    const f=await fixture([3,1]);await f.start().expect(200);
    const state=f.repo.rooms.get(f.code)!.state,vertexId=state.board.vertices[0].id;
    const results=await Promise.all([f.act(0,{type:'placeSetupSettlement',vertexId},1,'setup-race-a'),f.act(0,{type:'placeSetupSettlement',vertexId},1,'setup-race-b')]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    expect(f.repo.rooms.get(f.code)!.state.buildings).toHaveLength(1);
    await f.act(1,{type:'placeSetupSettlement',vertexId},2,'setup-occupied').expect(422);
    expect(f.repo.rooms.get(f.code)!.version).toBe(2);
    const adjacent=state.board.vertices[0].neighborIds[0];
    await f.act(1,{type:'placeSetupSettlement',vertexId:adjacent},2,'setup-adjacent').expect(200);
    expect(f.repo.rooms.get(f.code)!.state.phase).toBe('setup');
  });

  it('only the server creates contract lots and strict requests reject contract tampering',async()=>{
    const f=await playing(),room=f.repo.rooms.get(f.code)!;
    room.state=openAuction({...room.state,round:30},30);
    expect(['metal','wood','wheat','cotton']).toContain(room.state.auction.lot!.product);
    const before=structuredClone(room);
    await f.act(0,{type:'CREATE_CONTRACT',product:'machinery',quantity:1},room.version).expect(400);
    await f.act(0,{type:'SUBMIT_BID',amount:20,product:'machinery'},room.version).expect(400);
    await f.act(0,{type:'DELIVER_CONTRACT',contractId:'x',quantity:1,referenceValue:999},room.version).expect(400);
    expect(f.repo.rooms.get(f.code)).toEqual(before);
  });

  it.each([1,2,3,4])('starts only with 2–4 members: %i',async(count)=>{
    const f=await fixture([3,1,0,2].slice(0,count));
    const result=await f.start().expect(count===1?409:200);
    if(count===1){expect(result.body.error).toBe('NEED_TWO_TO_FOUR_PLAYERS');return}
    expect(result.body.state.seats).toEqual([3,1,0,2].slice(0,count));
    expect(result.body.state.players.map((p:{id:number})=>p.id)).toEqual([3,1,0,2].slice(0,count));
    await f.start(1,'not-host-start',1).expect(403);
  });
  it.each([0,-1,1.5])('rejects invalid target %s on the backend',async(targetProfit)=>{
    const f=await fixture([3,1]);
    await request(f.app).post(f.base+'/start').auth(f.players[0].reconnectToken,{type:'bearer'}).set('Idempotency-Key','invalid-target').send({expectedVersion:0,targetProfit}).expect(400);
  });

  it('creates, joins, hashes credentials and omits private fields',async()=>{
    const f=await fixture(),room=f.repo.rooms.get(f.code)!;
    expect(room.players).toHaveLength(4);
    expect(room.players[0].reconnectTokenHash).not.toBe(f.players[0].reconnectToken);
    expect(JSON.stringify(room)).not.toContain(f.players[0].reconnectToken);
    const response=await request(f.app).get(f.base).auth(f.players[0].reconnectToken,{type:'bearer'}).expect(200);
    expect(JSON.stringify(response.body)).not.toContain('reconnectTokenHash');
    await request(f.app).post(`${f.base}/join`).send({displayName:'Extra',companyId:0}).expect(409);
  });
  it('rejects duplicate companies, malformed input and nonmembers',async()=>{
    const f=await fixture([0]);
    await request(f.app).post(`${f.base}/join`).send({displayName:'Duplicate',companyId:0}).expect(409);
    await request(f.app).post('/api/rooms').send({displayName:'X',companyId:4}).expect(400);
    await request(f.app).get(`${f.base}/state`).expect(401);
    const stranger=await fixture([1]);
    await request(f.app).get(f.base).auth(stranger.players[0].reconnectToken,{type:'bearer'}).expect(403);
    await request(f.app).post(`${f.base}/actions`).auth(stranger.players[0].reconnectToken,{type:'bearer'}).set('Idempotency-Key','outsider-key').send({expectedVersion:0,action:{type:'ROLL_DICE'}}).expect(403);
  });
  it('requires host and at least two players; preserves seat/company mapping',async()=>{
    const small=await fixture([0]);await small.start().expect(409);
    const f=await fixture([3,1,0,2]);await f.start(1).expect(403);
    await f.start().expect(200);
    expect(f.repo.rooms.get(f.code)!.state.seats).toEqual([3,1,0,2]);
    await f.start(0,'another-start',1).expect(409);
  });
  it('validates gameplay, server dice, ownership and spoofing',async()=>{
    const f=await playing();
    await f.act(0,{type:'END_TURN'},9).expect(422);
    await f.act(1,{type:'ROLL_DICE'},9).expect(422);
    await f.act(0,{type:'ROLL_DICE',playerId:1},9).expect(400);
    await f.act(0,{type:'ROLL_DICE',dice:[6,6]},9).expect(400);
    const roll=await f.act(0,{type:'ROLL_DICE'},9).expect(200);
    expect(roll.body.state.dice).toEqual([2,2]);
    await f.act(0,{type:'ROLL_DICE'},10).expect(422);
    await f.act(0,{type:'BUY_RAW_MATERIAL',resource:'metal',quantity:1},10).expect(422);
    await f.act(0,{type:'UPGRADE_SETTLEMENT',vertexId:f.repo.rooms.get(f.code)!.state.buildings[1].vertexId},10).expect(422);
    await f.act(0,{type:'SET_CASH',cash:99999},10).expect(400);
    await f.act(0,{type:'CLOSE_AUCTION'},10).expect(400);
    await f.act(0,{type:'END_TURN'},10).expect(200);
  });
  it('replays idempotent actions without mutation and rejects key reuse',async()=>{
    const f=await playing();
    await f.act(0,{type:'ROLL_DICE'},9,'same-action-key').expect(200);
    const retry=await f.act(0,{type:'ROLL_DICE'},9,'same-action-key').expect(200);
    expect(retry.body.replayed).toBe(true);expect(retry.body.appliedVersion).toBe(10);
    expect(f.repo.rooms.get(f.code)!.actions).toHaveLength(10);
    await f.act(0,{type:'END_TURN'},10,'same-action-key').expect(409);
    await f.act(0,{type:'END_TURN'},9,'stale-action-key').expect(409);
  });
  it('serializes simultaneous actions and concurrent joins',async()=>{
    const f=await playing();
    const responses=await Promise.all([f.act(0,{type:'ROLL_DICE'},9,'concurrent-key-a'),f.act(0,{type:'ROLL_DICE'},9,'concurrent-key-b')]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
    const g=await fixture([0,1,2]);
    const joins=await Promise.all([1,2].map(()=>request(g.app).post(`${g.base}/join`).send({displayName:'Last',companyId:3})));
    expect(joins.map(r=>r.status).sort()).toEqual([201,409]);
    expect(g.repo.rooms.get(g.code)!.players).toHaveLength(4);
  });
  it('deduplicates simultaneous identical requests and authenticates start retries',async()=>{
    const f=await fixture();
    const starts=await Promise.all([f.start(),f.start()]);
    expect(starts.map(r=>r.status)).toEqual([200,200]);
    expect(starts.filter(r=>r.body.replayed)).toHaveLength(1);
    expect(f.repo.rooms.get(f.code)!.version).toBe(1);
    await f.start(1).expect(403);
    await request(f.app).post(`${f.base}/actions`).auth(f.players[0].reconnectToken,{type:'bearer'}).send({expectedVersion:1,action:{type:'ROLL_DICE'}}).expect(400);
  });
  it('keeps opponents bids private in every response and publishes winning result',async()=>{
    const f=await playing(),room=f.repo.rooms.get(f.code)!;
    room.state=openAuction({...room.state,round:3},3);
    const first=await f.act(0,{type:'SUBMIT_BID',amount:20},9).expect(200);
    expect(first.body.state.auction.sealedBids).toEqual([{playerId:0,amount:20,order:0}]);
    const other=await request(f.app).get(`${f.base}/state`).auth(f.players[1].reconnectToken,{type:'bearer'}).expect(200);
    expect(other.body.state.auction.sealedBids).toEqual([]);
    expect(other.body.state.seed).toBeUndefined();expect(other.body.state.board.seed).toBeUndefined();
    const second=await f.act(1,{type:'SUBMIT_BID',amount:10},10).expect(200);
    expect(second.body.state.auction.sealedBids).toEqual([{playerId:1,amount:10,order:1}]);
    await f.act(2,{type:'SKIP_BID'},11).expect(200);
    const final=await f.act(3,{type:'SKIP_BID'},12).expect(200);
    expect(final.body.state.contracts.at(-1)).toMatchObject({winnerId:1,winningBid:10});
    expect(final.body.state.auction.sealedBids).toEqual([]);
    expect(f.repo.rooms.get(f.code)!.bids).toHaveLength(2);
  });
  it('restores state in a fresh service and rolls back failed transactions',async()=>{
    const f=await playing(),before=structuredClone(f.repo.rooms.get(f.code)!);
    const fresh=new RoomService(f.repo);
    const result=await fresh.get(f.code,f.players[0].reconnectToken,true);
    expect(result).toMatchObject({version:9,state:{phase:'playing',buildings:before.state.buildings}});
    await expect(f.repo.transact(f.code,room=>{room.version=999;throw new Error('failure')})).rejects.toThrow('failure');
    expect(f.repo.rooms.get(f.code)).toEqual(before);
  });
});
