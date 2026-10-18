import {MULTIPLAYER_RULES_VERSION} from '../rules/lobbyRules';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createWaitingState} from '../rules/gameState';
import type {RoomUpdate} from '../network/protocol';
const transport=vi.hoisted(()=>({callbacks:new Map<string,(value?:unknown)=>void>(),emit:vi.fn(),send:vi.fn(),disconnect:vi.fn(),connect:vi.fn()}));
vi.mock('socket.io-client',()=>({io:()=>({connected:true,on:(name:string,callback:(value?:unknown)=>void)=>{transport.callbacks.set(name,callback)},disconnect:transport.disconnect,connect:transport.connect,emit:transport.emit,timeout:()=>({emitWithAck:transport.send})})}));
const session={roomCode:'ABCDEFGH',reconnectToken:'test-reconnect-token'};
function update(version=1,companyId=0):RoomUpdate{
  const {seed:_seed,board,...state}=createWaitingState('test-room');const {seed:_boardSeed,...publicBoard}=board;
  return {rulesVersion:MULTIPLAYER_RULES_VERSION,version,self:{playerId:'self',companyId},room:{id:'test-room',roomCode:session.roomCode,hostPlayerId:'self',version,status:'PLAYING',maxPlayers:4,players:[{id:'self',displayName:'Player',companyId,seatIndex:0}]},state:{...state,board:publicBoard,phase:'playing'}};
}
beforeEach(()=>{
  vi.resetModules();vi.clearAllMocks();transport.callbacks.clear();const storage=new Map([['merchant-empires-session-v1',JSON.stringify(session)]]);
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
  transport.send.mockImplementation(()=>new Promise(()=>{}));
});
describe('authoritative frontend store',()=>{
  it('does not award resources on local roll input and only displays server resource snapshots',async()=>{
    const {useGameStore,restoreConnection}=await import('./gameStore');restoreConnection();
    const initial=update(1);initial.state.players[0].resources.metal=7;
    transport.callbacks.get('room:update')!(initial);
    useGameStore.getState().roll();
    expect(transport.send).toHaveBeenCalled();
    expect(useGameStore.getState().players[0].resources.metal).toBe(7);
    const server=update(2);server.state.players[0].resources.metal=22;
    server.state.dice=[3,3];server.state.rolled=true;
    transport.callbacks.get('room:update')!(server);
    expect(useGameStore.getState().players[0].resources.metal).toBe(22);
    expect(useGameStore.getState().dice).toEqual([3,3]);
  });
  it.each([1,2,3,4])('validates and sends start correctly with %i members',async(count)=>{
    const {useGameStore,restoreConnection}=await import('./gameStore');
    restoreConnection();const next=update(0);next.room.status='WAITING';next.state.phase='waiting';
    next.room.players=Array.from({length:count},(_,i)=>({id:i===0?'self':'player-'+i,displayName:'P'+i,companyId:i,seatIndex:i}));
    transport.callbacks.get('room:update')!(next);
    const {startBlockReason}=await import('../rules/lobbyRules');
    expect(startBlockReason(useGameStore.getState(),1000)===null).toBe(count>=2);
    useGameStore.getState().start(1000);
    expect(transport.send).toHaveBeenCalledTimes(count===1?0:1);
  });
  it('accepts same-version lobby join broadcasts and immediately enables host start',async()=>{
    const {useGameStore,restoreConnection}=await import('./gameStore');
    const {startBlockReason}=await import('../rules/lobbyRules');
    restoreConnection();const next=update(0);next.room.status='WAITING';next.state.phase='waiting';
    transport.callbacks.get('room:update')!(next);
    expect(startBlockReason(useGameStore.getState(),1000)).toContain('ít nhất 2');
    const joined=structuredClone(next);joined.room.players.push({id:'second',displayName:'Second',companyId:3,seatIndex:1});
    expect(useGameStore.getState().room!.players).toHaveLength(1);
    transport.callbacks.get('room:update')!(joined);
    expect(useGameStore.getState().room!.players).toHaveLength(2);
    expect(startBlockReason(useGameStore.getState(),1000)).toBeNull();
    useGameStore.getState().start(1000);expect(transport.send).toHaveBeenCalledTimes(1);
  });
  it.each(['host','target','connection','busy','rules'])('shows a specific start blocker for %s',async(blocker)=>{
    const {useGameStore,restoreConnection}=await import('./gameStore');restoreConnection();
    const next=update(0);next.room.status='WAITING';next.state.phase='waiting';
    next.room.players.push({id:'second',displayName:'Second',companyId:3,seatIndex:1});
    if(blocker==='host')next.room.hostPlayerId='second';
    if(blocker==='rules')delete next.rulesVersion;
    transport.callbacks.get('room:update')!(next);
    if(blocker==='connection')useGameStore.setState({connection:'syncing'});
    if(blocker==='busy')useGameStore.setState({busy:true});
    useGameStore.getState().start(blocker==='target'?1.5:1000);
    expect(transport.send).not.toHaveBeenCalled();
    expect(useGameStore.getState().notice).toBeTruthy();
  });

  it('restores tab identity and sends actions without changing game state optimistically',async()=>{
    const {useGameStore,restoreConnection}=await import('./gameStore');restoreConnection();
    transport.callbacks.get('room:update')!(update());
    const before=useGameStore.getState();before.roll();
    expect(transport.send).toHaveBeenCalledWith('game:action',expect.objectContaining({expectedVersion:1,action:{type:'ROLL_DICE'}}));
    expect(useGameStore.getState().dice).toBeNull();expect(useGameStore.getState().players).toEqual(before.players);
    expect(useGameStore.getState().busy).toBe(true);
    const next=update(2);next.state.dice=[3,4];next.state.rolled=true;transport.callbacks.get('room:update')!(next);
    expect(useGameStore.getState().dice).toEqual([3,4]);
  });
  it('keeps the local company identity and rejects out-of-turn input before transmission',async()=>{
    const {useGameStore,restoreConnection}=await import('./gameStore');restoreConnection();transport.callbacks.get('room:update')!(update(1,2));
    expect(useGameStore.getState().localPlayerId).toBe(2);useGameStore.getState().roll();
    expect(transport.send).not.toHaveBeenCalled();expect(useGameStore.getState().dice).toBeNull();
  });
  it('ignores older state and disables gameplay when the session moves to another tab',async()=>{
    const {useGameStore,restoreConnection,canControl}=await import('./gameStore');restoreConnection();transport.callbacks.get('room:update')!(update(3));
    transport.callbacks.get('room:update')!(update(2));expect(useGameStore.getState().version).toBe(3);
    transport.callbacks.get('session:replaced')!();expect(canControl(useGameStore.getState())).toBe(false);
    useGameStore.getState().roll();expect(transport.send).not.toHaveBeenCalled();expect(transport.disconnect).toHaveBeenCalled();
  });
  it('retries the same persisted command after a refresh rather than inventing a new key',async()=>{
    const pending={event:'game:action',body:{idempotencyKey:'pending-during-refresh',expectedVersion:1,action:{type:'ROLL_DICE'}}};
    sessionStorage.setItem('merchant-empires-pending-v1',JSON.stringify(pending));
    const {useGameStore,restoreConnection}=await import('./gameStore');restoreConnection();transport.callbacks.get('room:update')!(update(2));
    expect(transport.send).toHaveBeenCalledWith(pending.event,pending.body);expect(useGameStore.getState().busy).toBe(true);
  });
});
