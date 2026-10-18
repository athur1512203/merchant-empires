import {afterAll,describe,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {openAuction} from '../../src/rules/auctionRules';
import {isRawMaterial} from '../../src/rules/economyConfig';
import {PrismaRoomRepository} from '../src/prismaRepository';
import {canPlaceSetupSettlement} from '../../src/rules/settlementRules';
import type {GameState} from '../../src/rules/types';
import type {RoomService} from '../src/service';
import type {roomView,stateView} from '../src/projection';
import {io,type Socket} from 'socket.io-client';
import type {RoomUpdate} from '../../src/network/protocol';
type Created=Awaited<ReturnType<RoomService['create']>>;
type StateResponse=ReturnType<typeof stateView>&{replayed?:boolean;appliedVersion?:number};

describe.skipIf(!process.env.TEST_DATABASE_URL)('real backend restart with PostgreSQL',()=>{
  const db=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL??'postgresql://unused:unused@localhost/unused'}}});
  let child:ChildProcess|undefined;
  const sockets:Socket[]=[],updates=new Map<Socket,RoomUpdate>();
  async function stop(){
    if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited}
    child=undefined;
  }
  async function start(port:number){
    child=spawn(process.execPath,['--import','tsx','server/src/index.ts'],{
      cwd:process.cwd(),windowsHide:true,env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']
    });
    const current=child;
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Backend startup timed out (private output suppressed)')),45_000);
      current.stdout!.on('data',data=>{if(String(data).includes('Merchant Empires API ready')){clearTimeout(timer);resolve()}});
      current.stderr!.on('data',()=>{});
      current.once('error',()=>{clearTimeout(timer);reject(new Error('Backend process failed to start'))});
      current.once('exit',()=>{clearTimeout(timer);reject(new Error('Backend exited before readiness (private output suppressed)'))});
    });
  }
  afterAll(async()=>{sockets.forEach(s=>s.disconnect());await stop();await db.$disconnect()},30_000);
  it.each([2,3,4])('persists %i players across a real backend restart and reconnect',async(count)=>{
    sockets.splice(0).forEach(s=>s.disconnect());updates.clear();
    // Remember existing records without logging private state. Only new test rooms are mutated.
    const baseline=await db.gameRoom.findMany({select:{id:true,updatedAt:true,snapshot:{select:{version:true,updatedAt:true}}}});
    const tables=await db.$queryRaw<{tablename:string}[]>`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`;
    expect(tables.map(t=>t.tablename)).toEqual(expect.arrayContaining(['GameRoom','RoomPlayer','GameSnapshot','GameAction','AuctionBid','_prisma_migrations']));
    const migrations=await db.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(Number(migrations[0].count)).toBeGreaterThan(0);
    const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
    const address=listener.address();if(!address||typeof address==='string')throw new Error('No test port');
    const port=address.port;await new Promise<void>(resolve=>listener.close(()=>resolve()));
    await start(port);
    const base=`http://127.0.0.1:${port}/api/rooms`;
    async function http<T=StateResponse>(path:string,method='GET',body?:unknown,token?:string,key?:string):Promise<T>{
      const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30_000)});
      const result=await response.json();
      const error=(result as {error?:string}).error;
      expect(response.status,`HTTP ${method} ${path}: ${error??'OK'}`).toBe(method==='POST'&&(path===''||path.endsWith('/join'))?201:200);
      return result as T;
    }
    const host=await http<Created>('','POST',{displayName:'TASK06A-NEON-RESTART-HOST',companyId:0});
    const code=host.room.roomCode,id=host.room.id,players=[host];
    for(let companyId=1;companyId<count;companyId++)players.push(await http<Created>(`/${code}/join`,'POST',{displayName:`TASK06A-NEON-RESTART-P${companyId}`,companyId}));
    for(const player of players){
      const socket=io(`http://127.0.0.1:${port}`,{auth:{roomCode:code,reconnectToken:player.reconnectToken},reconnectionDelay:250,reconnectionDelayMax:1000});
      sockets.push(socket);socket.on('room:update',(update:RoomUpdate)=>updates.set(socket,update));
    }
    await expect.poll(()=>sockets.every(s=>s.connected&&updates.has(s)),{timeout:45_000}).toBe(true);
    const room=await http<ReturnType<typeof roomView>>(`/${code}`,'GET',undefined,host.reconnectToken);
    expect(room.players).toHaveLength(count);
    await http(`/${code}/start`,'POST',{expectedVersion:0,targetProfit:1000},host.reconnectToken,'neon-start-001');
    for(let playerId=0;playerId<count;playerId++){
      const snapshot=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
      const state=snapshot.state as unknown as GameState;
      const vertexId=state.board.vertices.find(v=>canPlaceSetupSettlement(state,playerId,v.id).ok)!.id;
      await http(`/${code}/actions`,'POST',{expectedVersion:playerId+1,action:{type:'placeSetupSettlement',vertexId}},players[playerId].reconnectToken,`neon-setup-${playerId}`);
    }
    await http(`/${code}/actions`,'POST',{expectedVersion:count+1,action:{type:'ROLL_DICE'}},host.reconnectToken,'neon-roll-001');
    const before=await http(`/${code}/state`,'GET',undefined,host.reconnectToken);
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===count+2),{timeout:30_000}).toBe(true);
    for(const socket of sockets)expect(updates.get(socket)!.state).toEqual(before.state);
    const stored=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
    expect(stored.version).toBe(count+2);
    expect(stored.state).toMatchObject({phase:'playing',buildings:before.state.buildings,dice:before.state.dice,rolled:true});
    const members=await db.roomPlayer.findMany({where:{roomId:id}});
    expect(members).toHaveLength(count);
    for(let i=0;i<count;i++)expect(members.find(m=>m.id===players[i].playerId)!.reconnectTokenHash).not.toBe(players[i].reconnectToken);
    expect(await db.gameAction.count({where:{roomId:id}})).toBe(count+2);
    const persistedRoom=await db.gameRoom.findUniqueOrThrow({where:{id}});
    expect(persistedRoom.status).toBe('PLAYING');
    const oldPid=child!.pid;
    await stop();await start(port);
    expect(child!.pid).not.toBe(oldPid);
    const recovered=await http(`/${code}/state`,'GET',undefined,host.reconnectToken);
    await expect.poll(()=>sockets.every(s=>s.connected),{timeout:45_000}).toBe(true);
    for(const socket of sockets){updates.delete(socket);socket.emit('room:sync')}
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===count+2),{timeout:30_000}).toBe(true);
    for(const socket of sockets)expect(updates.get(socket)!.state).toEqual(before.state);
    expect(recovered).toEqual(before);
    const unchanged=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
    expect(unchanged).toEqual(stored);
    const replay=await http(`/${code}/actions`,'POST',{expectedVersion:count+1,action:{type:'ROLL_DICE'}},host.reconnectToken,'neon-roll-001');
    expect(replay).toMatchObject({replayed:true,appliedVersion:count+2,version:count+2});
    expect(await db.gameAction.count({where:{roomId:id}})).toBe(count+2);
    await http(`/${code}/actions`,'POST',{expectedVersion:count+2,action:{type:'END_TURN'}},host.reconnectToken,'neon-end-001');
    const resumed=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
    expect(resumed.version).toBe(count+3);expect(resumed.state).toMatchObject({turnIndex:1,rolled:false});
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===count+3),{timeout:30_000}).toBe(true);
    const existing=await db.gameRoom.findMany({where:{id:{in:baseline.map(r=>r.id)}},select:{id:true,updatedAt:true,snapshot:{select:{version:true,updatedAt:true}}}});
    expect(existing.sort((a,b)=>a.id.localeCompare(b.id))).toEqual(baseline.sort((a,b)=>a.id.localeCompare(b.id)));
    await stop();
    // Retain this uniquely generated room as reviewable evidence. Never print tokens/state/URL.
    await writeFile(`server/neon-verification-${count}.json`,JSON.stringify({verifiedAt:new Date().toISOString(),roomCode:code,roomId:id,players:count,actions:count+3,version:count+3,phase:'playing',restart:'PASS',realtimeClients:count,realtimeReconnect:'PASS',exactSnapshotRestored:true,idempotencyAfterRestart:'PASS',existingRoomsUnchanged:baseline.length,tablesVerified:tables.map(t=>t.tablename).sort(),completedMigrations:Number(migrations[0].count)},null,2)+'\n');
    console.log(`NEON_VERIFIED roomCode=${code} roomId=${id} players=${count} actions=${count+3} version=${count+3} restart=PASS existingRoomsUnchanged=${baseline.length}`);
  },180_000);

  it.each([[2,3],[3,30],[4,33]])('restores a sealed tender with %i players after round %i',async(count,round)=>{
    sockets.splice(0).forEach(s=>s.disconnect());updates.clear();
    const baseline=await db.gameRoom.findMany({select:{id:true,updatedAt:true,snapshot:{select:{version:true,updatedAt:true}}}});
    const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
    const address=listener.address();if(!address||typeof address==='string')throw new Error('No test port');
    const port=address.port;await new Promise<void>(resolve=>listener.close(()=>resolve()));await start(port);
    const base='http://127.0.0.1:'+port+'/api/rooms';
    async function http<T=StateResponse>(path:string,body?:unknown,token?:string,key?:string):Promise<T>{
      const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      expect(response.status).toBe(body!==undefined&&(path===''||path.endsWith('/join'))?201:200);return await response.json() as T;
    }
    const host=await http<Created>('',{displayName:'TASK08-TENDER-HOST',companyId:0}),code=host.room.roomCode,id=host.room.id,players=[host];
    for(let companyId=1;companyId<count;companyId++)players.push(await http<Created>('/'+code+'/join',{displayName:'TASK08-TENDER-'+companyId,companyId}));
    await http('/'+code+'/start',{expectedVersion:0,targetProfit:999999},host.reconnectToken,'task08-start');
    for(let who=0;who<count;who++){
      const stored=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}}),state=stored.state as unknown as GameState;
      const vertexId=state.board.vertices.find(v=>canPlaceSetupSettlement(state,who,v.id).ok)!.id;
      await http('/'+code+'/actions',{expectedVersion:stored.version,action:{type:'placeSetupSettlement',vertexId}},players[who].reconnectToken,'task08-setup-'+who);
    }
    const repo=new PrismaRoomRepository(db);
    await repo.transact(code,r=>{
      // Only this freshly created test room is advanced to the requested boundary.
      expect(r.players.every(p=>p.displayName.startsWith('TASK08-TENDER-'))).toBe(true);
      r.state=openAuction({...r.state,round},round);
      if(round===33)for(let seed=0;isRawMaterial(r.state.auction.lot!.product);seed++)r.state=openAuction({...r.state,seed,auction:{...r.state.auction,status:'idle',openedAfterRound:null}},round);
      r.version++;
    });
    for(const player of players){
      const socket=io('http://127.0.0.1:'+port,{auth:{roomCode:code,reconnectToken:player.reconnectToken},reconnectionDelay:250,reconnectionDelayMax:1000});
      sockets.push(socket);socket.on('room:update',(update:RoomUpdate)=>updates.set(socket,update));
    }
    await expect.poll(()=>sockets.every(s=>s.connected&&updates.has(s)),{timeout:45000}).toBe(true);
    const beforeBid=await http('/'+code+'/state',undefined,host.reconnectToken);
    await http('/'+code+'/actions',{expectedVersion:beforeBid.version,action:{type:'SUBMIT_BID',amount:30}},host.reconnectToken,'task08-first-bid');
    const own=await http('/'+code+'/state',undefined,host.reconnectToken),other=await http('/'+code+'/state',undefined,players[1].reconnectToken);
    expect(own.state.auction).toMatchObject({status:'open',bidSeat:1,sealedBids:[{playerId:0,amount:30}]});expect(other.state.auction.sealedBids).toEqual([]);
    const persisted=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}}),pid=child!.pid;
    await stop();await start(port);expect(child!.pid).not.toBe(pid);
    expect(await http('/'+code+'/state',undefined,host.reconnectToken)).toEqual(own);
    expect(await http('/'+code+'/state',undefined,players[1].reconnectToken)).toEqual(other);
    expect(await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}})).toEqual(persisted);
    for(const socket of sockets){updates.delete(socket);socket.emit('room:sync')}
    await expect.poll(()=>sockets.every(s=>s.connected&&updates.get(s)?.version===own.version),{timeout:45000}).toBe(true);
    expect(updates.get(sockets[0])!.state.auction.sealedBids).toHaveLength(1);
    for(const socket of sockets.slice(1))expect(updates.get(socket)!.state.auction.sealedBids).toEqual([]);
    const replay=await http('/'+code+'/actions',{expectedVersion:beforeBid.version,action:{type:'SUBMIT_BID',amount:30}},host.reconnectToken,'task08-first-bid');
    expect(replay.replayed).toBe(true);expect(await db.auctionBid.count({where:{roomId:id}})).toBe(1);
    let version=own.version;
    for(let who=1;who<count;who++)await http('/'+code+'/actions',{expectedVersion:version++,action:who===1?{type:'SUBMIT_BID',amount:30}:{type:'SKIP_BID'}},players[who].reconnectToken,'task08-decision-'+who);
    const closed=await http('/'+code+'/state',undefined,host.reconnectToken);
    expect(closed.state.auction.status).toBe('idle');expect(closed.state.round).toBe(round+1);
    expect(closed.state.contracts.at(-1)).toMatchObject({winnerId:0,winningBid:30,deadlineRound:round+3});
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===closed.version),{timeout:30000}).toBe(true);
    for(const socket of sockets)expect(updates.get(socket)!.state.contracts).toEqual(closed.state.contracts);
    const existing=await db.gameRoom.findMany({where:{id:{in:baseline.map(r=>r.id)}},select:{id:true,updatedAt:true,snapshot:{select:{version:true,updatedAt:true}}}});
    expect(existing.sort((a,b)=>a.id.localeCompare(b.id))).toEqual(baseline.sort((a,b)=>a.id.localeCompare(b.id)));
    await stop();
  },180000);
});
