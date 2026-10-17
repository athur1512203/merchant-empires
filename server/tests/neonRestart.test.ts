import {afterAll,describe,expect,it} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
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
  it('creates through HTTP, verifies Neon rows, restarts the OS process and resumes exactly',async()=>{
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
    for(let companyId=1;companyId<4;companyId++)players.push(await http<Created>(`/${code}/join`,'POST',{displayName:`TASK06A-NEON-RESTART-P${companyId}`,companyId}));
    for(const player of players){
      const socket=io(`http://127.0.0.1:${port}`,{auth:{roomCode:code,reconnectToken:player.reconnectToken},reconnectionDelay:250,reconnectionDelayMax:1000});
      sockets.push(socket);socket.on('room:update',(update:RoomUpdate)=>updates.set(socket,update));
    }
    await expect.poll(()=>sockets.every(s=>s.connected&&updates.has(s)),{timeout:45_000}).toBe(true);
    const room=await http<ReturnType<typeof roomView>>(`/${code}`,'GET',undefined,host.reconnectToken);
    expect(room.players).toHaveLength(4);
    await http(`/${code}/start`,'POST',{expectedVersion:0,targetProfit:1000},host.reconnectToken,'neon-start-001');
    for(let playerId=0;playerId<4;playerId++){
      const snapshot=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
      const state=snapshot.state as unknown as GameState;
      const vertexId=state.board.vertices.find(v=>canPlaceSetupSettlement(state,playerId,v.id).ok)!.id;
      await http(`/${code}/actions`,'POST',{expectedVersion:playerId+1,action:{type:'placeSetupSettlement',vertexId}},players[playerId].reconnectToken,`neon-setup-${playerId}`);
    }
    await http(`/${code}/actions`,'POST',{expectedVersion:5,action:{type:'ROLL_DICE'}},host.reconnectToken,'neon-roll-001');
    const before=await http(`/${code}/state`,'GET',undefined,host.reconnectToken);
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===6),{timeout:30_000}).toBe(true);
    for(const socket of sockets)expect(updates.get(socket)!.state).toEqual(before.state);
    const stored=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
    expect(stored.version).toBe(6);
    expect(stored.state).toMatchObject({phase:'playing',buildings:before.state.buildings,dice:before.state.dice,rolled:true});
    const members=await db.roomPlayer.findMany({where:{roomId:id}});
    expect(members).toHaveLength(4);
    for(let i=0;i<4;i++)expect(members.find(m=>m.id===players[i].playerId)!.reconnectTokenHash).not.toBe(players[i].reconnectToken);
    expect(await db.gameAction.count({where:{roomId:id}})).toBe(6);
    const persistedRoom=await db.gameRoom.findUniqueOrThrow({where:{id}});
    expect(persistedRoom.status).toBe('PLAYING');
    const oldPid=child!.pid;
    await stop();await start(port);
    expect(child!.pid).not.toBe(oldPid);
    const recovered=await http(`/${code}/state`,'GET',undefined,host.reconnectToken);
    await expect.poll(()=>sockets.every(s=>s.connected),{timeout:45_000}).toBe(true);
    for(const socket of sockets){updates.delete(socket);socket.emit('room:sync')}
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===6),{timeout:30_000}).toBe(true);
    for(const socket of sockets)expect(updates.get(socket)!.state).toEqual(before.state);
    expect(recovered).toEqual(before);
    const unchanged=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
    expect(unchanged).toEqual(stored);
    const replay=await http(`/${code}/actions`,'POST',{expectedVersion:5,action:{type:'ROLL_DICE'}},host.reconnectToken,'neon-roll-001');
    expect(replay).toMatchObject({replayed:true,appliedVersion:6,version:6});
    expect(await db.gameAction.count({where:{roomId:id}})).toBe(6);
    await http(`/${code}/actions`,'POST',{expectedVersion:6,action:{type:'END_TURN'}},host.reconnectToken,'neon-end-001');
    const resumed=await db.gameSnapshot.findUniqueOrThrow({where:{roomId:id}});
    expect(resumed.version).toBe(7);expect(resumed.state).toMatchObject({turnIndex:1,rolled:false});
    await expect.poll(()=>sockets.every(s=>updates.get(s)?.version===7),{timeout:30_000}).toBe(true);
    const existing=await db.gameRoom.findMany({where:{id:{in:baseline.map(r=>r.id)}},select:{id:true,updatedAt:true,snapshot:{select:{version:true,updatedAt:true}}}});
    expect(existing.sort((a,b)=>a.id.localeCompare(b.id))).toEqual(baseline.sort((a,b)=>a.id.localeCompare(b.id)));
    // Retain this uniquely generated room as reviewable evidence. Never print tokens/state/URL.
    await writeFile('server/neon-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),roomCode:code,roomId:id,players:4,actions:7,version:7,phase:'playing',restart:'PASS',realtimeClients:4,realtimeReconnect:'PASS',exactSnapshotRestored:true,idempotencyAfterRestart:'PASS',existingRoomsUnchanged:baseline.length,tablesVerified:tables.map(t=>t.tablename).sort(),completedMigrations:Number(migrations[0].count)},null,2)+'\n');
    console.log(`NEON_VERIFIED roomCode=${code} roomId=${id} players=4 actions=7 version=7 restart=PASS existingRoomsUnchanged=${baseline.length}`);
  },180_000);
});
