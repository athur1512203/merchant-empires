import {afterEach,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import request from 'supertest';
import {io,type Socket} from 'socket.io-client';
import {createApp} from '../src/app';
import {attachRealtime} from '../src/realtime';
import {RoomService} from '../src/service';
import {MemoryRepository} from './memoryRepository';
import {canPlaceSetupSettlement} from '../../src/rules/settlementRules';
import {updateMarketPrices} from '../../src/rules/marketRules';
import {mulberry32} from '../../src/rules/rng';
import {CONSTRUCTION_RECIPES} from '../../src/rules/constructionProgression';
import {openAuction} from '../../src/rules/auctionRules';
import type {Ack,RoomUpdate,ClientAction} from '../../src/network/protocol';
const disposers:(()=>Promise<void>)[]=[];
const socketOnce=(socket:Socket,event:string)=>new Promise<void>(resolve=>socket.once(event,()=>resolve()));
afterEach(async()=>{for(const dispose of disposers.splice(0).reverse())await dispose()});
async function fixture(companies=[0,1,2,3]){
  const repo=new MemoryRepository(),service=new RoomService(repo,()=>.25,()=>42),app=createApp(service),server=createServer(app),realtime=attachRealtime(server,service);
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();if(!address||typeof address==='string')throw new Error('No port');
  const url=`http://127.0.0.1:${address.port}`;
  const sockets:Socket[]=[],updates=new Map<Socket,RoomUpdate>();
  disposers.push(async()=>{sockets.forEach(s=>s.disconnect());await new Promise<void>(resolve=>realtime.io.close(()=>resolve()))});
  const host=(await request(app).post('/api/rooms').send({displayName:'Realtime host',companyId:companies[0]}).expect(201)).body;
  const code=host.room.roomCode,players=[host];
  async function connect(token=host.reconnectToken,roomCode=code){
    const socket=io(url,{auth:{roomCode,reconnectToken:token},autoConnect:false,reconnection:false});sockets.push(socket);
    socket.on('room:update',(update:RoomUpdate)=>updates.set(socket,update));
    const ready=socketOnce(socket,'connect');socket.connect();await ready;
    await expect.poll(()=>updates.has(socket)).toBe(true);
    return socket;
  }
  const first=await connect();
  for(const companyId of companies.slice(1))players.push((await request(app).post(`/api/rooms/${code}/join`).send({displayName:`P${companyId}`,companyId}).expect(201)).body);
  const clients=[first];for(const player of players.slice(1))clients.push(await connect(player.reconnectToken));
  await expect.poll(()=>updates.get(first)?.room.players.length).toBe(companies.length);
  let key=0;
  async function act(who:number,action:ClientAction,version=repo.rooms.get(code)!.version,idempotencyKey=`realtime-action-${++key}`){
    return clients[who].timeout(3000).emitWithAck('game:action',{action,expectedVersion:version,idempotencyKey}) as Promise<Ack>;
  }
  async function started(){
    const ack=await clients[0].timeout(3000).emitWithAck('game:start',{expectedVersion:0,targetProfit:1000,idempotencyKey:'realtime-start'});expect(ack.ok).toBe(true);
    for(let who=0;who<companies.length*2;who++){
      const state=repo.rooms.get(code)!.state,companyId=players[who%companies.length].room.players.find((p:{id:string})=>p.id===players[who%companies.length].playerId)!.companyId;
      const candidates=state.board.vertices.filter(v=>canPlaceSetupSettlement(state,companyId,v.id).ok);
      const vertexId=(candidates.find(v=>v.hexIds.some(id=>state.board.hexes.some(h=>h.id===id&&h.number===4)))??candidates[0]).id;
      expect((await act(who%companies.length,{type:'placeSetupSettlement',vertexId})).ok).toBe(true);
    }
    await expect.poll(()=>clients.every(s=>updates.get(s)?.version===companies.length*2+1)).toBe(true);
  }
  return {repo,service,app,code,players,clients,updates,connect,act,started,url,sockets};
}
describe('Socket.IO multiplayer',()=>{
  it.each([2,3,4])('synchronizes factory extraction, upgrades and reconnect without duplicate gains for %i players',async(count)=>{
    const f=await fixture([0,1,2,3].slice(0,count));await f.started();
    const room=()=>f.repo.rooms.get(f.code)!,s=room().state;
    s.board.hexes=s.board.hexes.map(h=>({...h,number:4,resource:'metal'}));
    s.buildings=s.buildings.map(b=>({...b,level:2}));
    s.factories=s.buildings.filter(b=>b.playerId<2).map(b=>({vertexId:b.vertexId,playerId:b.playerId,level:b.playerId===0?1:3,usedCapacity:0}));
    s.players=s.players.map(p=>({...p,cash:10000,resources:{metal:100,wood:100,wheat:100,cotton:100}}));
    const expected=(id:number,yieldAmount:number)=>s.buildings.filter(b=>b.playerId===id).reduce((sum,b)=>sum+s.board.vertices.find(v=>v.id===b.vertexId)!.hexIds.length*yieldAmount,0);
    expect((await f.act(0,{type:'ROLL_DICE'})).ok).toBe(true);
    for(const p of room().state.players)expect(p.resources.metal).toBe(100+expected(p.id,p.id===0?3:p.id===1?5:2));
    await expect.poll(()=>f.clients.every(c=>f.updates.get(c)?.version===room().version)).toBe(true);
    for(const c of f.clients)expect(f.updates.get(c)!.state.players).toEqual(room().state.players);
    const beforeReconnect=structuredClone(room().state);
    f.clients[1].disconnect();f.clients[1]=await f.connect(f.players[1].reconnectToken);
    expect(f.updates.get(f.clients[1])!.state.players).toEqual(beforeReconnect.players);
    expect(room().state).toEqual(beforeReconnect);
    const home=room().state.buildings.find(b=>b.playerId===0)!;
    expect((await f.act(0,{type:'UPGRADE_FACTORY',vertexId:home.vertexId})).ok).toBe(true);
    // No extraction is granted by the upgrade itself (only its existing cost).
    expect(room().state.players[0].resources.metal).toBe(beforeReconnect.players[0].resources.metal-1);
    for(let who=0;who<count;who++){
      if(who)expect((await f.act(who,{type:'ROLL_DICE'})).ok).toBe(true);
      expect((await f.act(who,{type:'END_TURN'})).ok).toBe(true);
    }
    const beforeNext=structuredClone(room().state.players[0]);
    expect((await f.act(0,{type:'ROLL_DICE'})).ok).toBe(true);
    const gain=room().state.buildings.filter(b=>b.playerId===0).reduce((n,b)=>n+room().state.board.vertices.find(v=>v.id===b.vertexId)!.hexIds.length*(b.vertexId===home.vertexId?4:3),0);
    expect(room().state.players[0].resources.metal-beforeNext.resources.metal).toBe(gain);
    await expect.poll(()=>f.clients.every(c=>f.updates.get(c)?.version===room().version)).toBe(true);
    for(const c of f.clients)expect(f.updates.get(c)!.state.players).toEqual(room().state.players);
  });
  it.each([2,3,4])('synchronizes two setup passes and reconnect with %i members',async(count)=>{
    const f=await fixture([3,1,0,2].slice(0,count));
    const room=()=>f.repo.rooms.get(f.code)!;
    const ack=await f.clients[0].timeout(3000).emitWithAck('game:start',{expectedVersion:0,targetProfit:1000,idempotencyKey:'setup-two-passes'});
    expect(ack.ok).toBe(true);
    for(let i=0;i<count*2;i++){
      const who=i%count,state=room().state;
      const vertexId=i===1?state.board.vertices.find(v=>v.id===state.buildings[0].vertexId)!.neighborIds[0]:state.board.vertices.find(v=>!state.buildings.some(b=>b.vertexId===v.id))!.id;
      expect((await f.act((who+1)%count,{type:'placeSetupSettlement',vertexId})).ok).toBe(false);
      expect((await f.act(who,{type:'placeSetupSettlement',vertexId})).ok).toBe(true);
      await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===room().version)).toBe(true);
      for(const socket of f.clients){
        expect(f.updates.get(socket)!.state.buildings).toEqual(room().state.buildings);
        const {seed:_seed,...publicBoard}=room().state.board;
        expect(f.updates.get(socket)!.state.board).toEqual(publicBoard);
        expect(f.updates.get(socket)!.state.board.hexes).toHaveLength(61);
        expect(f.updates.get(socket)!.state.board.mapSeed).toBe(room().state.board.seed);
      }
      if(i===count-1){
        const before=structuredClone(room().state);
        f.clients[0].disconnect();f.clients[0]=await f.connect(f.players[0].reconnectToken);
        expect(f.updates.get(f.clients[0])!.state.buildings).toEqual(before.buildings);
        expect(f.updates.get(f.clients[0])!.state.board.hexes).toEqual(before.board.hexes);
        expect(f.updates.get(f.clients[0])!.state.board.vertices).toEqual(before.board.vertices);
        expect(f.updates.get(f.clients[0])!.state.turnIndex).toBe(0);
        expect(room().state).toEqual(before);
      }
    }
    expect(room().state).toMatchObject({phase:'playing',round:1,turnIndex:0});
    for(const id of room().state.seats)expect(room().state.buildings.filter(b=>b.playerId===id)).toHaveLength(2);
    expect((await f.act(0,{type:'ROLL_DICE'})).ok).toBe(true);
  });

  it('broadcasts every construction stage and rejects opponent/skip requests on server',async()=>{
    const f=await fixture([0,3]);await f.started();
    const room=()=>f.repo.rooms.get(f.code)!;
    const home=room().state.buildings[0].vertexId;
    room().state.rolled=true;room().state.players[0]={...room().state.players[0],cash:10000,resources:{metal:100,wood:100,wheat:100,cotton:100}};
    expect((await f.act(0,{type:'BUILD_FACTORY',vertexId:home})).ok).toBe(false);
    for(const step of CONSTRUCTION_RECIPES.slice(1)){
      expect((await f.act(1,{type:step.type,vertexId:home})).ok).toBe(false);
      expect((await f.act(0,{type:step.type,vertexId:home})).ok).toBe(true);
      await expect.poll(()=>f.clients.every(c=>f.updates.get(c)?.version===room().version)).toBe(true);
      for(const c of f.clients){expect(f.updates.get(c)!.state.buildings).toEqual(room().state.buildings);expect(f.updates.get(c)!.state.factories).toEqual(room().state.factories)}
    }
    expect((await f.act(0,{type:'UPGRADE_FACTORY',vertexId:home})).ok).toBe(false);
    expect(room().state.buildings[0].level).toBe(2);expect(room().state.factories[0].level).toBe(3);
  });

  it.each([[3,1],[2,0,3],[3,1,0,2]])('runs rounds, tender and reconnect with companies %j',async(...companies:number[])=>{
    const f=await fixture(companies);await f.started();
    const room=()=>f.repo.rooms.get(f.code)!;
    expect(room().state.seats).toEqual(companies);
    expect(room().state.players.map(p=>p.id)).toEqual(companies);
    await request(f.app).post(`/api/rooms/${f.code}/join`).send({displayName:'Late',companyId:0}).expect(409);
    for(let round=1;round<=3;round++){
      for(let who=0;who<companies.length;who++){
        expect(room().state.round).toBe(round);
        expect(room().state.seats[room().state.turnIndex]).toBe(companies[who]);
        expect((await f.act(who,{type:'ROLL_DICE'})).ok).toBe(true);
        const beforeEnd=structuredClone(room().state);
        expect((await f.act(who,{type:'END_TURN'})).ok).toBe(true);
        const expectedMarket=who===companies.length-1?updateMarketPrices(beforeEnd,mulberry32((beforeEnd.seed+(round+1)*7_919)>>>0)):{resourcePrices:beforeEnd.resourcePrices,marketPressure:beforeEnd.marketPressure};
        expect(room().state.resourcePrices).toEqual(expectedMarket.resourcePrices);
        expect(room().state.marketPressure).toEqual(expectedMarket.marketPressure);
      }
    }
    expect(room().state.auction.status).toBe('open');
    expect((await f.act(0,{type:'SUBMIT_BID',amount:10})).ok).toBe(true);
    const before=structuredClone(room().state),last=companies.length-1;
    f.clients[last].disconnect();
    await expect.poll(()=>f.updates.get(f.clients[0])?.onlinePlayerIds?.length).toBe(companies.length-1);
    expect(room().state).toEqual(before);
    f.clients[last]=await f.connect(f.players[last].reconnectToken);
    expect(f.updates.get(f.clients[last])!.state.seats).toEqual(companies);
    for(let who=1;who<companies.length;who++)expect((await f.act(who,{type:'SKIP_BID'})).ok).toBe(true);
    expect(room().state).toMatchObject({round:4,turnIndex:0,auction:{status:'idle'}});
    expect(room().state.contracts.at(-1)).toMatchObject({winnerId:companies[0],winningBid:10});
    for(let who=0;who<companies.length;who++){
      expect((await f.act(who,{type:'ROLL_DICE'})).ok).toBe(true);
      expect((await f.act(who,{type:'END_TURN'})).ok).toBe(true);
    }
    expect(room().state.round).toBe(5);
  });

  it('updates lobby after HTTP joins, enforces four unique companies and exposes only availability before joining',async()=>{
    const f=await fixture();
    expect(f.updates.get(f.clients[0])!.room.players).toHaveLength(4);
    const publicInfo=await request(f.app).get(`/api/rooms/${f.code}/availability`).expect(200);
    expect(Object.keys(publicInfo.body).sort()).toEqual(['playerCount','roomCode','status','takenCompanyIds']);
    await request(f.app).post(`/api/rooms/${f.code}/join`).send({displayName:'Fifth',companyId:0}).expect(409);
    const small=await fixture([0]);await request(small.app).post(`/api/rooms/${small.code}/join`).send({displayName:'Duplicate',companyId:0}).expect(409);
    expect(JSON.stringify([...f.updates.values()])).not.toContain('reconnectToken');
  });
  it('synchronizes server dice, production, buildings and turns to four clients using company IDs rather than seat numbers',async()=>{
    const f=await fixture([3,1,0,2]);await f.started();
    expect((await f.act(1,{type:'ROLL_DICE'}))).toMatchObject({ok:false,error:'ILLEGAL_ACTION'});
    expect((await f.act(0,{type:'ROLL_DICE'})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===10)).toBe(true);
    const state=f.repo.rooms.get(f.code)!.state;
    expect(state.dice).toEqual([2,2]);expect(state.buildings).toHaveLength(8);
    expect(state.players.filter(p=>Object.values(p.resources).some(n=>n>0)).length).toBeGreaterThan(1);
    for(const socket of f.clients){
      const update=f.updates.get(socket)!;
      expect(update.state.players).toEqual(state.players);expect(update.state.dice).toEqual([2,2]);expect(update.state.buildings).toEqual(state.buildings);
      expect(update.state).not.toHaveProperty('seed');expect(update.state.board).not.toHaveProperty('seed');
    }
    expect((await f.act(0,{type:'END_TURN'})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.state.turnIndex===1)).toBe(true);
  });
  it('rejects unauthenticated sockets, forged actors, unauthorized starts and invalid actions',async()=>{
    const f=await fixture();
    const bad=io(f.url,{autoConnect:false,reconnection:false,auth:{roomCode:f.code,reconnectToken:'invalid'}});f.sockets.push(bad);
    const denied=socketOnce(bad,'connect_error');bad.connect();await denied;expect(bad.connected).toBe(false);
    const start=await f.clients[1].timeout(3000).emitWithAck('game:start',{expectedVersion:0,targetProfit:1000,idempotencyKey:'unauthorized-start'});
    expect(start).toMatchObject({ok:false,error:'HOST_ONLY'});
    await f.started();
    const forged=await f.clients[0].timeout(3000).emitWithAck('game:action',{expectedVersion:9,idempotencyKey:'forged-player-id',action:{type:'ROLL_DICE',playerId:1,dice:[6,6]}});
    expect(forged).toMatchObject({ok:false,error:'INVALID_REQUEST'});
    expect((await f.act(0,{type:'BUY_RAW_MATERIAL',resource:'metal',quantity:1})).ok).toBe(false);
    expect(f.repo.rooms.get(f.code)!.version).toBe(9);
  });
  it('persists idempotency across reconnect, transfers sole control and restores viewer identity',async()=>{
    const f=await fixture();await f.started();
    expect((await f.act(0,{type:'ROLL_DICE'},9,'persistent-roll')).ok).toBe(true);
    const old=f.clients[0],replaced=socketOnce(old,'session:replaced');
    const refreshed=await f.connect(f.players[0].reconnectToken);await replaced;
    expect(old.connected).toBe(false);
    expect(f.updates.get(refreshed)!.self.companyId).toBe(0);
    const replay=await refreshed.timeout(3000).emitWithAck('game:action',{expectedVersion:9,idempotencyKey:'persistent-roll',action:{type:'ROLL_DICE'}});
    expect(replay).toMatchObject({ok:true,appliedVersion:10});expect(f.repo.rooms.get(f.code)!.version).toBe(10);
    refreshed.disconnect();const restored=await f.connect(f.players[0].reconnectToken);
    expect(f.updates.get(restored)!.state.dice).toEqual([2,2]);
  });
  it('never emits opponents sealed bids on any socket, including reconnect, then publishes the winner',async()=>{
    const f=await fixture();await f.started();
    const room=f.repo.rooms.get(f.code)!;room.state=openAuction({...room.state,round:3},3);
    expect((await f.act(0,{type:'SUBMIT_BID',amount:20})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===10)).toBe(true);
    for(let i=0;i<4;i++)expect(f.updates.get(f.clients[i])!.state.auction.sealedBids).toHaveLength(i===0?1:0);
    expect((await f.act(1,{type:'SUBMIT_BID',amount:10})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===11)).toBe(true);
    for(let i=0;i<4;i++)expect(f.updates.get(f.clients[i])!.state.auction.sealedBids.every(b=>b.playerId===i)).toBe(true);
    f.clients[2].disconnect();f.clients[2]=await f.connect(f.players[2].reconnectToken);
    expect(f.updates.get(f.clients[2])!.state.auction.sealedBids).toEqual([]);
    expect((await f.act(2,{type:'SKIP_BID'})).ok).toBe(true);expect((await f.act(3,{type:'SKIP_BID'})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===13)).toBe(true);
    for(const socket of f.clients)expect(f.updates.get(socket)!.state.contracts.at(-1)).toMatchObject({winnerId:1,winningBid:10});
  });
});
