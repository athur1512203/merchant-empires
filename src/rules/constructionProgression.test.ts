import {describe,it,expect} from 'vitest';
import {applyAction,createWaitingState} from './gameState';
import {CONSTRUCTION_RECIPES,constructionAction,nextConstructionStep} from './constructionProgression';
import {calculateResourceProduction} from './productionRules';
import {factoryCapacity,remainingCapacity} from './factoryRules';
import {normalizeConstructionState} from './constructionCompatibility';
import type {GameAction,GameState} from './types';

function rich():GameState{
  const s=createWaitingState();s.phase='playing';s.rolled=true;s.targetProfit=999999;
  s.buildings=[{vertexId:s.board.vertices[0].id,playerId:0,type:'settlement',level:1}];
  s.players[0]={...s.players[0],cash:10000,resources:{metal:100,wood:100,wheat:100,cotton:100},inventoryCost:{...s.players[0].inventoryCost,metal:1000,wood:1000,wheat:1000,cotton:1000}};
  return s;
}
function advance(s:GameState,action:GameAction){const result=applyAction(s,action);expect(result.ok,result.ok?'':result.error).toBe(true);if(!result.ok)throw new Error(result.error);return result.state}
function stages(){
  let s=rich();const id=s.buildings[0].vertexId,result=[s];
  for(const step of CONSTRUCTION_RECIPES.slice(1)){s=advance(s,constructionAction(step,0,id));result.push(s)}
  return result;
}
describe('sequential construction',()=>{
  it('uses exactly five recipes with existing costs',()=>{
    expect(CONSTRUCTION_RECIPES.map(r=>r.cost.gold)).toEqual([40,50,70,110,180]);
    expect(CONSTRUCTION_RECIPES.map(r=>r.label).filter(l=>l.includes('định cư')&&l.includes('3'))).toEqual([]);
  });
  it('settlement 1 -> 2 -> factory 1 -> 2 -> 3 preserves the home and accounts every cost',()=>{
    const states=stages();
    expect(states.map(s=>[s.buildings[0].level,s.factories[0]?.level??0])).toEqual([[1,0],[2,0],[2,1],[2,2],[2,3]]);
    for(let i=0;i<4;i++){
      const before=states[i],after=states[i+1],step=CONSTRUCTION_RECIPES[i+1],p=after.players[0],prev=before.players[0];
      expect(nextConstructionStep(before,before.buildings[0].vertexId,0)).toEqual(step);
      expect(p.cash).toBe(prev.cash-step.cost.gold);
      for(const [resource,n] of Object.entries(step.cost.resources))expect(p.resources[resource as keyof typeof p.resources]).toBe(prev.resources[resource as keyof typeof p.resources]-n!);
      expect(p.profit).toBe(0);expect(p.revenue).toBe(0);expect(p.costs).toBe(0);
      expect(p.capitalExpenditure).toBeGreaterThan(prev.capitalExpenditure);
      expect(after.buildings).toHaveLength(1);expect(after.factories.length).toBe(i===0?0:1);
      if(i>0)expect(after.buildings).toEqual(before.buildings);
    }
    expect(nextConstructionStep(states[4],states[4].buildings[0].vertexId,0)).toBeNull();
    expect(states.slice(2).map(s=>factoryCapacity(s.factories[0].level))).toEqual([1,2,3]);
  });
  it('rejects skipped stages, duplicates and maximum levels',()=>{
    const states=stages(),id=states[0].buildings[0].vertexId;
    expect(applyAction(states[0],{type:'BUILD_FACTORY',playerId:0,vertexId:id}).ok).toBe(false);
    expect(applyAction(states[0],{type:'UPGRADE_FACTORY',playerId:0,vertexId:id}).ok).toBe(false);
    for(const s of states.slice(1))expect(applyAction(s,{type:'UPGRADE_SETTLEMENT',playerId:0,vertexId:id}).ok).toBe(false);
    for(const s of states.slice(2))expect(applyAction(s,{type:'BUILD_FACTORY',playerId:0,vertexId:id}).ok).toBe(false);
    expect(applyAction(states[4],{type:'UPGRADE_FACTORY',playerId:0,vertexId:id}).ok).toBe(false);
  });
  it.each([0,1,2,3])('validates stage %i against resources, gold, turn, roll, phase, auction and ownership',stage=>{
    const s=stages()[stage],id=s.buildings[0].vertexId,step=CONSTRUCTION_RECIPES[stage+1],action=constructionAction(step,0,id);
    const variants=[
      {...s,players:s.players.map(p=>p.id===0?{...p,cash:0}:p)},
      ...Object.keys(step.cost.resources).map(r=>({...s,players:s.players.map(p=>p.id===0?{...p,resources:{...p.resources,[r]:0}}:p)})),
      {...s,turnIndex:1},{...s,rolled:false},{...s,phase:'finished' as const},
      {...s,auction:{...s.auction,status:'open' as const}},
      {...s,buildings:s.buildings.map(b=>({...b,playerId:1})),factories:s.factories.map(f=>({...f,playerId:1}))}
    ];
    for(const state of variants){const before=structuredClone(state);expect(applyAction(state,action).ok).toBe(false);expect(state).toEqual(before)}
    expect(nextConstructionStep({...s,buildings:s.buildings.map(b=>({...b,playerId:1}))},id,0)).toBeNull();
  });
  it('factory extraction replaces settlement yield and upgrades preserve used capacity',()=>{
    const states=stages(),home=states[1],factory=states[2];
    for(let total=2;total<=12;total++){const previous=calculateResourceProduction(home,total),next=calculateResourceProduction(factory,total);for(const [id,gain] of Object.entries(previous))for(const [resource,n] of Object.entries(gain))expect(next[Number(id)][resource as keyof typeof gain]).toBe(n!/2*3)}
    const s=states[2];s.factories[0].usedCapacity=1;
    const next=advance(s,{type:'UPGRADE_FACTORY',playerId:0,vertexId:s.buildings[0].vertexId});
    expect(next.factories[0].usedCapacity).toBe(1);expect(remainingCapacity(next.factories[0])).toBe(1);
  });
  it('keeps at most four settlements per company',()=>{
    let s=rich();s.buildings=[];
    for(let n=0;n<4;n++){const v=s.board.vertices.find(v=>!s.buildings.some(b=>b.vertexId===v.id||s.board.adjacency[v.id].includes(b.vertexId)))!;s=advance(s,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:v.id})}
    const v=s.board.vertices.find(v=>!s.buildings.some(b=>b.vertexId===v.id||s.board.adjacency[v.id].includes(b.vertexId)))!;
    expect(applyAction(s,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:v.id}).ok).toBe(false);
  });
});
describe('legacy construction compatibility',()=>{
  it('preserves original records and all economic data, without mutating snapshots',()=>{
    const s=rich();delete s.constructionRulesVersion;
    (s.buildings[0] as unknown as {level:number}).level=3;
    s.buildings.push({vertexId:s.board.vertices[3].id,playerId:1,type:'settlement',level:1});
    s.factories=[{vertexId:s.buildings[1].vertexId,playerId:1,level:2,usedCapacity:1}];
    const before=structuredClone(s),next=normalizeConstructionState(s);
    expect(s).toEqual(before);expect(next.buildings.map(b=>b.level)).toEqual([2,2]);
    expect(next.players).toEqual(s.players);expect(next.factories).toEqual(s.factories);
    expect(next.legacyConstruction).toEqual({buildings:before.buildings,factories:before.factories});
    expect(normalizeConstructionState(next)).toBe(next);
  });
});
