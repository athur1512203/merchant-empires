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
import {openAuction} from '../../src/rules/auctionRules';
import type {Ack,RoomUpdate,ClientAction} from '../../src/network/protocol';
const disposers:(()=>Promise<void>)[]=[];
const socketOnce=(socket:Socket,event:string)=>new Promise<void>(resolve=>socket.once(event,()=>resolve()));
afterEach(async()=>{for(const dispose of disposers.splice(0).reverse())await dispose()});
async function fixture(companies=[0,1,2,3]){
  const repo=new MemoryRepository(),service=new RoomService(repo,()=>.25),app=createApp(service),server=createServer(app),realtime=attachRealtime(server,service);
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
    for(let who=0;who<4;who++){
      const state=repo.rooms.get(code)!.state,companyId=players[who].room.players.find((p:{id:string})=>p.id===players[who].playerId)!.companyId;
      const candidates=state.board.vertices.filter(v=>canPlaceSetupSettlement(state,companyId,v.id).ok);
      const vertexId=(candidates.find(v=>v.hexIds.some(id=>state.board.hexes.some(h=>h.id===id&&h.number===4)))??candidates[0]).id;
      expect((await act(who,{type:'placeSetupSettlement',vertexId})).ok).toBe(true);
    }
    await expect.poll(()=>clients.every(s=>updates.get(s)?.version===5)).toBe(true);
  }
  return {repo,service,app,code,players,clients,updates,connect,act,started,url,sockets};
}
describe('Socket.IO multiplayer',()=>{
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
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===6)).toBe(true);
    const state=f.repo.rooms.get(f.code)!.state;
    expect(state.dice).toEqual([2,2]);expect(state.buildings).toHaveLength(4);
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
    const forged=await f.clients[0].timeout(3000).emitWithAck('game:action',{expectedVersion:5,idempotencyKey:'forged-player-id',action:{type:'ROLL_DICE',playerId:1,dice:[6,6]}});
    expect(forged).toMatchObject({ok:false,error:'INVALID_REQUEST'});
    expect((await f.act(0,{type:'BUY_RAW_MATERIAL',resource:'metal',quantity:1})).ok).toBe(false);
    expect(f.repo.rooms.get(f.code)!.version).toBe(5);
  });
  it('persists idempotency across reconnect, transfers sole control and restores viewer identity',async()=>{
    const f=await fixture();await f.started();
    expect((await f.act(0,{type:'ROLL_DICE'},5,'persistent-roll')).ok).toBe(true);
    const old=f.clients[0],replaced=socketOnce(old,'session:replaced');
    const refreshed=await f.connect(f.players[0].reconnectToken);await replaced;
    expect(old.connected).toBe(false);
    expect(f.updates.get(refreshed)!.self.companyId).toBe(0);
    const replay=await refreshed.timeout(3000).emitWithAck('game:action',{expectedVersion:5,idempotencyKey:'persistent-roll',action:{type:'ROLL_DICE'}});
    expect(replay).toMatchObject({ok:true,appliedVersion:6});expect(f.repo.rooms.get(f.code)!.version).toBe(6);
    refreshed.disconnect();const restored=await f.connect(f.players[0].reconnectToken);
    expect(f.updates.get(restored)!.state.dice).toEqual([2,2]);
  });
  it('never emits opponents sealed bids on any socket, including reconnect, then publishes the winner',async()=>{
    const f=await fixture();await f.started();
    const room=f.repo.rooms.get(f.code)!;room.state=openAuction({...room.state,round:3},3);
    expect((await f.act(0,{type:'SUBMIT_BID',amount:20})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===6)).toBe(true);
    for(let i=0;i<4;i++)expect(f.updates.get(f.clients[i])!.state.auction.sealedBids).toHaveLength(i===0?1:0);
    expect((await f.act(1,{type:'SUBMIT_BID',amount:10})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===7)).toBe(true);
    for(let i=0;i<4;i++)expect(f.updates.get(f.clients[i])!.state.auction.sealedBids.every(b=>b.playerId===i)).toBe(true);
    f.clients[2].disconnect();f.clients[2]=await f.connect(f.players[2].reconnectToken);
    expect(f.updates.get(f.clients[2])!.state.auction.sealedBids).toEqual([]);
    expect((await f.act(2,{type:'SKIP_BID'})).ok).toBe(true);expect((await f.act(3,{type:'SKIP_BID'})).ok).toBe(true);
    await expect.poll(()=>f.clients.every(s=>f.updates.get(s)?.version===9)).toBe(true);
    for(const socket of f.clients)expect(f.updates.get(socket)!.state.contracts.at(-1)).toMatchObject({winnerId:1,winningBid:10});
  });
});
