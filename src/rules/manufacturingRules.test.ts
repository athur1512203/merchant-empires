import {describe,expect,it} from 'vitest';
import {PRODUCTS} from './types';
import {FACTORY_CAPACITY,RECIPES} from './economyConfig';
import {idleMaintenanceCharge} from './manufacturingRules';
import {applyAction,createWaitingState} from './gameState';
import type {GameState} from './types';

function playing(over:Partial<GameState>={}):GameState{return{...createWaitingState(),phase:'playing',targetProfit:9_999,seed:11,rolled:true,...over}}
function ready(over:Partial<GameState>={}):GameState{
  const s=playing(over),id=s.board.vertices[0].id;
  s.buildings=[{vertexId:id,playerId:0,type:'settlement',level:1}];
  s.factories=[{vertexId:id,playerId:0,level:3,usedCapacity:0}];
  s.players[0]={...s.players[0],cash:500,resources:{metal:20,wood:20,wheat:20,cotton:20},products:{...s.players[0].products,fabric:5},inventoryCost:{...s.players[0].inventoryCost,metal:200,wood:100,wheat:60,cotton:80,fabric:50}};
  return s;
}
const act=(s:GameState,a:Parameters<typeof applyAction>[1])=>applyAction(s,a);
const plant=(s:GameState)=>s.factories[0].vertexId;

describe('ManufacturingRules',()=>{
  it('nhà máy đa năng sản xuất cả 6 thành phẩm',()=>{
    let s=ready();
    for(const product of PRODUCTS){
      s={...s,factories:s.factories.map(f=>({...f,usedCapacity:0}))};
      const r=act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product,batches:1});
      expect(r.ok).toBe(true);
      if(r.ok)s=r.state;
    }
  });
  it('không sản xuất nếu thiếu nguyên liệu',()=>{
    const s=ready();s.players[0]={...s.players[0],resources:{...s.players[0].resources,metal:0}};
    expect(act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'machinery',batches:1}).ok).toBe(false);
  });
  it('không sản xuất nếu thiếu vàng',()=>{
    const s=ready();s.players[0]={...s.players[0],cash:0};
    expect(act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'furniture',batches:1}).ok).toBe(false);
  });
  it('không sản xuất vượt năng lực nhà máy',()=>{
    const s=ready();s.factories[0]={...s.factories[0],level:1,usedCapacity:0};
    expect(act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'flour',batches:FACTORY_CAPACITY[1]+1}).ok).toBe(false);
  });
  it('nhiều lần sản xuất trong lượt cộng dồn năng lực đã dùng',()=>{
    const s=ready();s.factories[0]={...s.factories[0],level:2,usedCapacity:0};
    const first=act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'flour',batches:1});
    expect(first.ok&&first.state.factories[0].usedCapacity).toBe(1);if(!first.ok)return;
    const second=act(first.state,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'fabric',batches:1});
    expect(second.ok&&second.state.factories[0].usedCapacity).toBe(2);if(!second.ok)return;
    expect(act(second.state,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'furniture',batches:1}).ok).toBe(false);
  });
  it.each([0,-1,1.5,NaN,Infinity])('từ chối số lô %s',batches=>expect(act(ready(),{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(ready()),product:'flour',batches}).ok).toBe(false));
  it('sản xuất trừ đúng đầu vào, cộng thành phẩm, không ghi doanh thu/lợi nhuận',()=>{
    const s=ready(),recipe=RECIPES.machinery,r=act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'machinery',batches:1});
    expect(r.ok).toBe(true);if(!r.ok)return;
    const p=r.state.players[0];
    expect(p.resources.metal).toBe(20-(recipe.inputs.metal??0));
    expect(p.products.machinery).toBe(recipe.output);
    expect(p.cash).toBe(500-recipe.gold);
    expect(p.revenue).toBe(0);
    expect(p.profit).toBe(0);
    expect(p.operatingCosts).toBe(0);
  });
  it('chuyển giá vốn nguyên liệu và phí gia công sang thành phẩm',()=>{
    const s=ready(),r=act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'machinery',batches:1});
    expect(r.ok).toBe(true);if(!r.ok)return;
    const p=r.state.players[0],material=Math.round(200*3/20);
    expect(p.inventoryCost.metal).toBe(200-material);
    expect(p.inventoryCost.machinery).toBe(material+RECIPES.machinery.gold);
  });
  it('không phí bảo trì khi nhà máy không hoạt động',()=>{
    const s=ready();s.factories[0]={...s.factories[0],usedCapacity:0};
    const cash=s.players[0].cash;
    expect(idleMaintenanceCharge(s.factories[0])).toBe(0);
    const r=act(s,{type:'END_TURN',playerId:0});
    expect(r.ok&&r.state.players[0].cash).toBe(cash);
  });
  it('action thất bại không đổi GameState',()=>{
    const s=ready();s.players[0]={...s.players[0],cash:0};const snap=structuredClone(s);
    act(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(s),product:'furniture',batches:1});
    expect(s).toEqual(snap);
  });
  it('không sản xuất ngoài lượt',()=>expect(act(ready(),{type:'MANUFACTURE_GOODS',playerId:1,vertexId:plant(ready()),product:'flour',batches:1}).ok).toBe(false));
  it('không sản xuất trước khi gieo',()=>expect(act({...ready(),rolled:false},{type:'MANUFACTURE_GOODS',playerId:0,vertexId:plant(ready()),product:'flour',batches:1}).ok).toBe(false));
  it('reset đúng năng lực khi đến lượt mới, không reset nhà máy người khác',()=>{
    const s=ready();
    s.factories=[
      {vertexId:s.board.vertices[0].id,playerId:0,level:2,usedCapacity:2},
      {vertexId:s.board.vertices[4].id,playerId:1,level:2,usedCapacity:2}
    ];
    const r=act(s,{type:'END_TURN',playerId:0});
    expect(r.ok).toBe(true);if(!r.ok)return;
    expect(r.state.factories.find(f=>f.playerId===1)?.usedCapacity).toBe(0);
    expect(r.state.factories.find(f=>f.playerId===0)?.usedCapacity).toBe(2);
  });
});
