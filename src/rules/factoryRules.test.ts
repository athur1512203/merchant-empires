import {describe,expect,it} from 'vitest';
import {FACTORY_COSTS} from './economyConfig';
import {applyAction,createWaitingState} from './gameState';
import type {GameState} from './types';

function playing(over:Partial<GameState>={}):GameState{return{...createWaitingState(),phase:'playing',targetProfit:500,seed:7,rolled:true,...over}}
function site(s:GameState){return s.board.vertices[0].id}
function withHome(over:Partial<GameState>={}):GameState{
  const s=playing(over),id=site(s);
  s.buildings=[{vertexId:id,playerId:0,type:'settlement',level:2}];
  s.players[0]={...s.players[0],cash:1000,resources:{metal:20,wood:20,wheat:20,cotton:20},inventoryCost:{...s.players[0].inventoryCost,metal:200,wood:0,wheat:0,cotton:0}};
  return s;
}
const act=(s:GameState,a:Parameters<typeof applyAction>[1])=>applyAction(s,a);

describe('FactoryRules',()=>{
  it('không xây nếu chưa có khu định cư',()=>expect(act(playing(),{type:'BUILD_FACTORY',playerId:0,vertexId:site(playing())}).ok).toBe(false));
  it('không xây trên khu định cư đối thủ',()=>{const s=withHome();s.buildings[0]={...s.buildings[0],playerId:1};expect(act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:site(s)}).ok).toBe(false)});
  it('không xây 2 nhà máy cùng khu',()=>{const s=withHome();s.factories=[{vertexId:site(s),playerId:0,level:1,usedCapacity:0}];expect(act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:site(s)}).ok).toBe(false)});
  it('không xây nếu thiếu vàng',()=>{const s=withHome();s.players[0]={...s.players[0],cash:10};expect(act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:site(s)}).ok).toBe(false)});
  it('không xây nếu thiếu nguyên liệu',()=>{const s=withHome();s.players[0]={...s.players[0],resources:{metal:0,wood:0,wheat:0,cotton:0}};expect(act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:site(s)}).ok).toBe(false)});
  it('xây thành công trừ đúng chi phí, nhà máy cấp 1, CAPEX không trừ lợi nhuận',()=>{
    const s=withHome(),r=act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:site(s)});
    expect(r.ok).toBe(true);if(!r.ok)return;
    const p=r.state.players[0],c=FACTORY_COSTS.build;
    expect(p.cash).toBe(1000-c.gold);
    expect(p.resources).toMatchObject({metal:18,wood:19,cotton:19});
    expect(p.profit).toBe(0);
    expect(p.capitalExpenditure).toBeGreaterThanOrEqual(c.gold);
    expect(r.state.factories[0]).toMatchObject({level:1,playerId:0,usedCapacity:0});
  });
  it('nâng cấp 1→2 rồi 2→3 và không quá cấp 3',()=>{
    let s=withHome(),id=site(s);
    let r=act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:id});expect(r.ok).toBe(true);if(!r.ok)return;
    r=act(r.state,{type:'UPGRADE_FACTORY',playerId:0,vertexId:id});expect(r.ok&&r.state.factories[0].level).toBe(2);if(!r.ok)return;
    r=act(r.state,{type:'UPGRADE_FACTORY',playerId:0,vertexId:id});expect(r.ok&&r.state.factories[0].level).toBe(3);if(!r.ok)return;
    expect(act(r.state,{type:'UPGRADE_FACTORY',playerId:0,vertexId:id}).ok).toBe(false);
  });
  it('không nâng cấp nhà máy đối thủ',()=>{
    const s=withHome(),id=site(s);
    s.factories=[{vertexId:id,playerId:1,level:1,usedCapacity:0}];
    expect(act(s,{type:'UPGRADE_FACTORY',playerId:0,vertexId:id}).ok).toBe(false);
  });
  it('action thất bại không đổi GameState',()=>{
    const s=withHome();s.players[0]={...s.players[0],cash:0};const snap=structuredClone(s);
    act(s,{type:'BUILD_FACTORY',playerId:0,vertexId:site(s)});
    expect(s).toEqual(snap);
  });
});
