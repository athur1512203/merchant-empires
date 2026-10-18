import {describe,expect,it} from 'vitest';
import {areVerticesAdjacent,generateBoard,rowLengths,ROW_COUNTS} from './boardRules';
import {canPlaceSettlement,canPlaceSetupSettlement} from './settlementRules';
import {applyAction,createCompany,createWaitingState,placeSetupSettlement,startMatch} from './gameState';

describe('BoardRules',()=>{
  it('builds 37 hexes in rows 4-5-6-7-6-5-4',()=>{
    const b=generateBoard(7);
    expect(b.hexes).toHaveLength(37);
    expect(rowLengths(b.hexes)).toEqual([...ROW_COUNTS]);
  });
  it('reproduces the same map for the same seed',()=>{
    const a=generateBoard(42),c=generateBoard(42),d=generateBoard(43);
    expect(a.hexes).toEqual(c.hexes);
    expect(a.vertices.map(v=>v.id)).toEqual(c.vertices.map(v=>v.id));
    expect(a.hexes.map(h=>h.resource+h.number).join()).not.toBe(d.hexes.map(h=>h.resource+h.number).join());
  });
  it('never uses dice token 7',()=>{
    for(const seed of [1,2,9,42,99])expect(generateBoard(seed).hexes.every(h=>h.number!==7&&h.number>=2&&h.number<=12)).toBe(true);
  });
  it('identifies vertices and adjacency without pixels',()=>{
    const b=generateBoard(1);
    const v=b.vertices[0];
    expect(v.id.includes('|')).toBe(true);
    expect(v.neighborIds.length).toBeGreaterThan(0);
    expect(areVerticesAdjacent(b,v.id,v.neighborIds[0])).toBe(true);
    expect(v.id).not.toMatch(/^-?\d+\.\d+/);
  });
  it('spreads four resources across the board',()=>{
    const counts={metal:0,wood:0,wheat:0,cotton:0};
    for(const h of generateBoard(11).hexes)counts[h.resource]++;
    expect(Object.values(counts).every(n=>n>=8&&n<=11)).toBe(true);
  });
});

describe('SettlementRules + setup',()=>{
  it('blocks duplicate vertices and allows adjacent vertices',()=>{
    const started=startMatch(createWaitingState(),1000,5);
    expect(started.ok).toBe(true);if(!started.ok)return;
    let state=started.state;
    const first=state.board.vertices[0];
    const near=first.neighborIds[0];
    const far=state.board.vertices.find(v=>v.id!==first.id&&!first.neighborIds.includes(v.id))!;
    state={...state,buildings:[{vertexId:first.id,playerId:0,type:'settlement',level:1}]};
    expect(canPlaceSettlement(state,first.id,1).ok).toBe(false);
    expect(canPlaceSettlement(state,near,1).ok).toBe(true);
    expect(canPlaceSettlement(state,far.id,1).ok).toBe(true);
  });
  it('places two setup passes P1-P4 then enters playing round 1',()=>{
    const started=startMatch(createWaitingState(),2500,8);
    expect(started.ok).toBe(true);if(!started.ok)return;
    let state=started.state;
    expect(state.phase).toBe('setup');
    expect(state.players.every(p=>p.cash===0&&p.profit===0&&p.resources.metal===0)).toBe(true);
    const taken=new Set<string>();
    for(let i=0;i<8;i++){
      const v=state.board.vertices.find(x=>canPlaceSetupSettlement(state,state.seats[state.turnIndex],x.id).ok)!;
      const r=placeSetupSettlement(state,state.seats[state.turnIndex],v.id);
      expect(r.ok).toBe(true);if(!r.ok)return;
      expect(taken.has(v.id)).toBe(false);
      taken.add(v.id);
      state=r.state;
    }
    expect(state.phase).toBe('playing');
    expect(state.round).toBe(1);
    expect(state.turnIndex).toBe(0);
    expect(state.buildings).toHaveLength(8);
  });
  it('rejects a third free settlement for the same company',()=>{
    const started=startMatch(createWaitingState(),1000,3);
    expect(started.ok).toBe(true);if(!started.ok)return;
    const v=started.state.board.vertices[10];
    const first=placeSetupSettlement(started.state,0,v.id);
    expect(first.ok).toBe(true);if(!first.ok)return;
    const hijack={...first.state,turnIndex:0,buildings:[...first.state.buildings,{...first.state.buildings[0],vertexId:first.state.board.vertices[11].id}]};
    const again=placeSetupSettlement(hijack,0,first.state.board.vertices.find(x=>x.id!==v.id)!.id);
    expect(again.ok).toBe(false);
    expect(again.ok===false&&again.error).toMatch(/2 khu định cư miễn phí/);
  });
  it('caps a company at 4 settlements',()=>{
    const started=startMatch(createWaitingState(),1000,4);
    expect(started.ok).toBe(true);if(!started.ok)return;
    const verts=started.state.board.vertices;
    const buildings=verts.slice(0,4).map((v,i)=>({vertexId:v.id,playerId:0,type:'settlement' as const,level:1 as const}));
    const isolated=verts.find(v=>!buildings.some(b=>b.vertexId===v.id||(started.state.board.adjacency[b.vertexId]??[]).includes(v.id)));
    const state={...started.state,phase:'playing' as const,buildings};
    expect(canPlaceSettlement(state,isolated?.id??verts[30].id,0).ok).toBe(false);
  });
  it('applyAction startMatch requires waiting + four companies',()=>{
    expect(applyAction(createWaitingState(),{type:'startMatch',targetProfit:1.5,seed:1}).ok).toBe(false);
    expect(createCompany(2).loans).toBe(0);
  });
});
