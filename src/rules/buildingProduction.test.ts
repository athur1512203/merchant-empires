import {describe,it,expect} from 'vitest';
import {createWaitingState,applyAction} from './gameState';
import {buildLogicTopology} from './boardRules';
import {calculateResourceProduction} from './productionRules';
import {rollDice} from './diceRules';
import {CONSTRUCTION_RECIPES} from './constructionProgression';
import {factoryCapacity} from './factoryRules';
import type {GameState,HexCell} from './types';

function fixture():GameState{
  const hexes:HexCell[]=[{id:'0,0',q:0,r:0,resource:'metal',number:6},{id:'1,0',q:1,r:0,resource:'metal',number:6},{id:'0,1',q:0,r:1,resource:'wood',number:6}];
  const board={seed:1,hexes,...buildLogicTopology(hexes)};
  const vertex=board.vertices.find(v=>v.hexIds.length===3)!;
  return{...createWaitingState(),phase:'playing',board,buildings:[{vertexId:vertex.id,playerId:0,type:'settlement',level:1}]};
}
describe('five-stage extraction',()=>{
  it.each([1,2,3,4,5])('awards exactly %i per matching hex, replacing the settlement yield',amount=>{
    const state=fixture(),home=state.buildings[0];home.level=amount===1?1:2;
    if(amount>=3)state.factories=[{vertexId:home.vertexId,playerId:0,level:amount-2 as 1|2|3,usedCapacity:0}];
    expect(calculateResourceProduction(state,6)).toEqual({0:{metal:amount*2,wood:amount}});
    const before=structuredClone(state),result=rollDice(state,0,()=>.4);
    expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
    expect(result.state.players[0].resources).toEqual({metal:amount*2,wood:amount,wheat:0,cotton:0});
    expect(result.state.players[0]).toMatchObject({cash:0,revenue:0,costs:0,profit:0,inventoryCost:before.players[0].inventoryCost});
    expect(result.state.factories).toEqual(before.factories);expect(state).toEqual(before);
    expect(rollDice(result.state,0,()=>.4).ok).toBe(false);
  });
  it('awards all owners, excludes nonmatching cells, and never activates a 7',()=>{
    const s=fixture(),v=s.board.vertices.find(v=>v.id!==s.buildings[0].vertexId&&v.hexIds.length>=2)!;
    s.buildings.push({vertexId:v.id,playerId:1,type:'settlement',level:2});
    s.factories=[{vertexId:v.id,playerId:1,level:3,usedCapacity:2}];
    expect(calculateResourceProduction(s,6)[0]).toEqual({metal:2,wood:1});
    expect(Object.values(calculateResourceProduction(s,6)[1]).reduce((a,b)=>a+(b??0),0)).toBe(v.hexIds.length*5);
    expect(calculateResourceProduction(s,5)).toEqual({});
    s.board.hexes=s.board.hexes.map(h=>({...h,number:7}));
    expect(calculateResourceProduction(s,7)).toEqual({});
    const values=[.4,.6];const r=rollDice(s,0,()=>values.shift()!);
    expect(r.ok&&r.state.players).toEqual(s.players);
  });
  it('uses each upgraded yield on the next roll without changing costs or manufacturing capacity',()=>{
    let s=fixture();s.players[0]={...s.players[0],cash:10000,resources:{metal:100,wood:100,wheat:100,cotton:100}};
    for(let stage=0;stage<5;stage++){
      if(stage){
        const step=CONSTRUCTION_RECIPES[stage],before=structuredClone(s.players[0]);
        const upgraded=applyAction(s,{type:step.type,playerId:0,vertexId:s.buildings[0].vertexId});
        if(!upgraded.ok)throw Error(upgraded.error);s=upgraded.state;
        expect(s.players[0].cash).toBe(before.cash-step.cost.gold);
        for(const r of ['metal','wood','wheat','cotton'] as const)expect(s.players[0].resources[r]).toBe(before.resources[r]-(step.cost.resources[r]??0));
      }
      const before=structuredClone(s.players[0]);const rolled=rollDice({...s,rolled:false},0,()=>.4);
      if(!rolled.ok)throw Error(rolled.error);s=rolled.state;
      expect(s.players[0].resources.metal-before.resources.metal).toBe((stage+1)*2);
      expect(s.players[0].resources.wood-before.resources.wood).toBe(stage+1);
      expect(s.players[0].inventoryCost).toEqual(before.inventoryCost);
      if(s.factories.length)expect(factoryCapacity(s.factories[0].level)).toBe(stage-1);
    }
  });
});
