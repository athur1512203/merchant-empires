import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createWaitingState} from '../rules/gameState';
import type {RoomUpdate} from '../network/protocol';
const transport=vi.hoisted(()=>({callbacks:new Map<string,(value?:unknown)=>void>(),emit:vi.fn(),send:vi.fn(),disconnect:vi.fn(),connect:vi.fn()}));
vi.mock('socket.io-client',()=>({io:()=>({connected:true,on:(name:string,callback:(value?:unknown)=>void)=>{transport.callbacks.set(name,callback)},disconnect:transport.disconnect,connect:transport.connect,emit:transport.emit,timeout:()=>({emitWithAck:transport.send})})}));
const session={roomCode:'ABCDEFGH',reconnectToken:'test-reconnect-token'};
function update(version=1,companyId=0):RoomUpdate{
  const {seed:_seed,board,...state}=createWaitingState('test-room');const {seed:_boardSeed,...publicBoard}=board;
  return {version,self:{playerId:'self',companyId},room:{id:'test-room',roomCode:session.roomCode,hostPlayerId:'self',version,status:'PLAYING',maxPlayers:4,players:[{id:'self',displayName:'Player',companyId,seatIndex:0}]},state:{...state,board:publicBoard,phase:'playing'}};
}
beforeEach(()=>{
  vi.resetModules();vi.clearAllMocks();transport.callbacks.clear();const storage=new Map([['merchant-empires-session-v1',JSON.stringify(session)]]);
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
  transport.send.mockImplementation(()=>new Promise(()=>{}));
});
describe('authoritative frontend store',()=>{
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
