import {describe,it,expect} from 'vitest';
import {RoomService} from '../src/service';
import {MemoryRepository} from './memoryRepository';
import {buildLogicTopology} from '../../src/rules/boardRules';

describe('persisted map snapshots',()=>{
  it.each([false,true])('preserves new/legacy geometry across service restart (legacy=%s)',async(legacy)=>{
    const repo=new MemoryRepository(),service=new RoomService(repo);
    const host=await service.create({displayName:'Map host',companyId:0});
    const code=host.room.roomCode;
    await service.join(code,{displayName:'Guest',companyId:1});
    await service.execute(code,host.reconnectToken,'start-map-test',{expectedVersion:0,targetProfit:1000},true);
    const room=repo.rooms.get(code)!;
    if(legacy){
      const hexes=[];
      for(let q=-3;q<=3;q++)for(let r=Math.max(-3,-q-3);r<=Math.min(3,-q+3);r++)hexes.push({id:`${q},${r}`,q,r,resource:'metal' as const,number:4});
      room.state.board={seed:42,hexes,...buildLogicTopology(hexes)};
    }
    const persisted=JSON.stringify(room),before=structuredClone(room.state.board);
    const restoredRepo=new MemoryRepository();
    restoredRepo.rooms.set(code,JSON.parse(persisted));
    const restarted=new RoomService(restoredRepo);
    const update=await restarted.get(code,host.reconnectToken,true);
    if(!('state' in update))throw new Error('Expected restored state');
    const {seed:_hidden,...publicBoard}=before;
    expect(update.state.board).toEqual(publicBoard);
    expect(update.state.board.hexes).toHaveLength(legacy?37:61);
    expect(restoredRepo.rooms.get(code)!.state.board).toEqual(before);
    if(!legacy)expect(update.state.board.mapSeed).toBe(before.seed);
    else expect(update.state.board.mapSeed).toBeUndefined();
  });
});
