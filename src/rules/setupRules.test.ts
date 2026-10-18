import {describe,it,expect} from 'vitest';
import {applyAction,createWaitingState} from './gameState';
import {canPlaceSettlement} from './settlementRules';
import {MAX_SETTLEMENTS,CONSTRUCTION_COSTS} from './economyConfig';
import {SETUP_SETTLEMENTS_PER_PLAYER} from './types';
import type {GameState,GameAction} from './types';
function accept(s:GameState,a:GameAction){const r=applyAction(s,a);expect(r.ok,r.ok?'':r.error).toBe(true);if(!r.ok)throw new Error(r.error);return r.state}
function started(count:number){return accept(createWaitingState(),{type:'startMatch',targetProfit:99999,seed:21,companyIds:[3,1,0,2].slice(0,count)})}
const empty=(s:GameState)=>s.board.vertices.find(v=>!s.buildings.some(b=>b.vertexId===v.id))!.id;
function finish(count:number){let s=started(count);for(let i=0;i<count*2;i++)s=accept(s,{type:'placeSetupSettlement',playerId:s.seats[i%count],vertexId:empty(s)});return s}
describe('two-pass free setup and four-settlement cap',()=>{
  it.each([2,3,4])('%i players place two passes in joining order, free and level 1',count=>{
    let s=started(count);const initialPlayers=structuredClone(s.players);
    const order=[...s.seats,...s.seats];
    for(const [i,playerId] of order.entries()){
      expect(s.seats[s.turnIndex]).toBe(playerId);expect(s.phase).toBe('setup');
      expect(applyAction(s,{type:'ROLL_DICE',playerId}).ok).toBe(false);
      const before=structuredClone(s),vertexId=empty(s);
      expect(applyAction(s,{type:'placeSetupSettlement',playerId:s.seats[(i+1)%count],vertexId}).ok).toBe(false);
      expect(s).toEqual(before);
      s=accept(s,{type:'placeSetupSettlement',playerId,vertexId});
      expect(s.buildings[i]).toMatchObject({vertexId,playerId,type:'settlement',level:1});
      expect(s.players).toEqual(initialPlayers);
      expect(s.phase).toBe(i===order.length-1?'playing':'setup');
    }
    expect(s).toMatchObject({round:1,turnIndex:0,dice:null,rolled:false});
    expect(s.buildings).toHaveLength(count*2);
    for(const id of s.seats)expect(s.buildings.filter(b=>b.playerId===id)).toHaveLength(2);
    expect(SETUP_SETTLEMENTS_PER_PLAYER).toBe(2);expect(MAX_SETTLEMENTS).toBe(4);
    expect(applyAction(s,{type:'placeSetupSettlement',playerId:s.seats[0],vertexId:empty(s)}).ok).toBe(false);
    expect(applyAction(s,{type:'ROLL_DICE',playerId:s.seats[0]}).ok).toBe(true);
  });
  it('allows adjacent/interleaved companies but rejects every occupied vertex',()=>{
    let s=started(2);const first=s.board.vertices.find(v=>v.neighborIds.length>=2)!;
    s=accept(s,{type:'placeSetupSettlement',playerId:3,vertexId:first.id});
    const before=structuredClone(s);
    expect(applyAction(s,{type:'placeSetupSettlement',playerId:1,vertexId:first.id}).ok).toBe(false);expect(s).toEqual(before);
    const neighbor=first.neighborIds[0];expect(canPlaceSettlement(s,neighbor,1).ok).toBe(true);
    s=accept(s,{type:'placeSetupSettlement',playerId:1,vertexId:neighbor});
    s=accept(s,{type:'placeSetupSettlement',playerId:3,vertexId:first.neighborIds[1]});
    const next=empty(s);s=accept(s,{type:'placeSetupSettlement',playerId:1,vertexId:next});
    expect(s.phase).toBe('playing');expect(new Set(s.buildings.map(b=>b.vertexId)).size).toBe(4);
  });
  it('permits only two paid additions after the two free homes, with existing costs',()=>{
    let s=finish(2);s.rolled=true;
    s.players[0]={...s.players[0],cash:1000,resources:{metal:20,wood:20,wheat:20,cotton:20}};
    for(let i=0;i<2;i++)s=accept(s,{type:'BUILD_SETTLEMENT',playerId:3,vertexId:empty(s)});
    expect(s.buildings.filter(b=>b.playerId===3)).toHaveLength(4);
    expect(s.players[0]).toMatchObject({cash:1000-2*CONSTRUCTION_COSTS.settlement.gold,resources:{metal:18,wood:16,wheat:18,cotton:20},capitalExpenditure:80,profit:0});
    const before=structuredClone(s);expect(applyAction(s,{type:'BUILD_SETTLEMENT',playerId:3,vertexId:empty(s)})).toMatchObject({ok:false,error:'Bạn đã đạt giới hạn 4 khu định cư.'});expect(s).toEqual(before);
  });
  it('continues a serialized mid-setup state without losing its turn or buildings',()=>{
    let s=started(3);
    for(let i=0;i<4;i++)s=accept(s,{type:'placeSetupSettlement',playerId:s.seats[s.turnIndex],vertexId:empty(s)});
    s=JSON.parse(JSON.stringify(s)) as GameState;
    expect(s.seats[s.turnIndex]).toBe(1);expect(s.buildings.map(b=>b.playerId)).toEqual([3,1,0,3]);
    while(s.phase==='setup')s=accept(s,{type:'placeSetupSettlement',playerId:s.seats[s.turnIndex],vertexId:empty(s)});
    expect(s.buildings).toHaveLength(6);
  });
  it('does not reopen already-playing legacy snapshots or add free buildings',()=>{
    const s={...finish(2),buildings:finish(2).buildings.slice(0,2)};
    const before=structuredClone(s);expect(applyAction(s,{type:'placeSetupSettlement',playerId:3,vertexId:empty(s)}).ok).toBe(false);expect(s).toEqual(before);
  });
});
