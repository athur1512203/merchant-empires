import {describe,expect,it} from 'vitest';
import {axialToPixel,buildTopology,createBoard,HEX_SIZE} from './hexGrid';
import {applyAction,createWaitingState} from '../rules/gameState';
import {canPlaceSetupSettlement} from '../rules/settlementRules';
import type {GameAction,GameState} from '../rules/types';
import {applyLoan,distribute,nextTurn,ownedSettlements,rollDice,settlementCapReason,settlementReason,setupPlacementOrder,shufflePlayers,tenderPhase,validSettlement} from './gameEngine';
import {awardContract,buildFactory,deliverContract,fluctuatePrices,hasReachedTarget,isValidTargetProfit,produce,sell,submitBid,upgradeFactory,upgradeSettlement,winnerByProfit} from './economyEngine';
import {BASE_RESOURCE_PRICES,FACTORY_CAPACITY,MAX_SETTLEMENTS_PER_PLAYER,contractForRound} from '../config/economy';
import type {Building,Contract,Factory,Player} from '../types';

const blank=():Player=>({id:0,name:'Test',color:'#fff',cash:1000,revenue:0,costs:0,operatingCosts:0,capitalExpenditure:0,loans:0,outstandingPenalty:0,profit:0,resources:{metal:10,wood:10,wheat:10,cotton:10},products:{machinery:0,rail:0,furniture:0,flour:0,fabric:0,clothing:0},inventoryCost:{metal:0,wood:0,wheat:0,cotton:0,machinery:0,rail:0,furniture:0,flour:0,fabric:0,clothing:0}});
const settlement=():Building=>({vertexId:'v1',playerId:0,type:'settlement',level:1});

describe('hex grid',()=>{it('creates exactly 37 hexes',()=>expect(createBoard()).toHaveLength(37));it('uses correct neighbor distance',()=>{const a=axialToPixel(0,0),b=axialToPixel(1,0);expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeCloseTo(Math.sqrt(3)*HEX_SIZE)});it('deduplicates shared vertices',()=>{const t=buildTopology(createBoard());expect(t.vertices.length).toBeLessThan(37*6);expect(new Set(t.vertices.map(v=>v.id)).size).toBe(t.vertices.length)})});

describe('rules',()=>{it('rolls 2–12',()=>{for(let i=0;i<100;i++){const d=rollDice();expect(d[0]+d[1]).toBeGreaterThanOrEqual(2);expect(d[0]+d[1]).toBeLessThanOrEqual(12)}});it('distributes adjacent resource by settlement level',()=>{const hs=createBoard(),t=buildTopology(hs),v=t.vertices[0],h=hs.find(x=>x.id===v.hexIds[0])!,bs:Building[]=[{vertexId:v.id,playerId:0,type:'settlement',level:2}];const p=distribute(hs,t.vertices,bs,[blank()],h.number)[0];expect(p.resources[h.resource]).toBeGreaterThanOrEqual(2)});it('blocks duplicate and adjacent settlements',()=>{const t=buildTopology(createBoard()),v=t.vertices[0],e=t.edges.find(x=>x.a===v.id||x.b===v.id)!;const neighbor=e.a===v.id?e.b:e.a,bs:Building[]=[{vertexId:v.id,playerId:0,type:'settlement',level:1}];expect(validSettlement(v.id,bs,t.edges)).toBe(false);expect(validSettlement(neighbor,bs,t.edges)).toBe(false)});it('explains invalid settlement placement',()=>{const t=buildTopology(createBoard()),v=t.vertices[0],e=t.edges.find(x=>x.a===v.id||x.b===v.id)!;const neighbor=e.a===v.id?e.b:e.a,bs:Building[]=[{vertexId:v.id,playerId:0,type:'settlement',level:1}];expect(settlementReason(v.id,bs,t.edges)).toMatch(/đã có/);expect(settlementReason(neighbor,bs,t.edges)).toMatch(/liền kề/)});it('uses one-pass setup order',()=>expect(setupPlacementOrder(4)).toEqual([0,1,2,3]));it('shuffles without dropping players',()=>{const ids=[0,1,2,3];expect(shufflePlayers(ids,()=>0.99).sort()).toEqual(ids)});it('cycles tender every three rounds',()=>expect([1,2,3,4].map(tenderPhase)).toEqual(['ANNOUNCEMENT','PREPARATION','OPEN BIDDING','ANNOUNCEMENT']));it('advances round after all four turns',()=>{expect(nextTurn(2,1)).toEqual({turn:3,round:1});expect(nextTurn(3,1)).toEqual({turn:0,round:2});expect(nextTurn(3,15)).toEqual({turn:0,round:16})});it('loan does not change profit',()=>{const p=applyLoan({...blank(),profit:99,cash:0},500);expect(p.cash).toBe(500);expect(p.profit).toBe(99)});it('caps settlements at 3 per player independently',()=>{expect(MAX_SETTLEMENTS_PER_PLAYER).toBe(3);const mine:Building[]=[{vertexId:'a',playerId:0,type:'settlement',level:1},{vertexId:'b',playerId:0,type:'settlement',level:2},{vertexId:'c',playerId:0,type:'settlement',level:1},{vertexId:'d',playerId:1,type:'settlement',level:1}];expect(ownedSettlements(0,mine)).toBe(3);expect(settlementCapReason(0,mine)).toMatch(/giới hạn 3/);expect(settlementCapReason(1,mine)).toBeNull();expect(settlementReason('e',mine,[],0)).toMatch(/giới hạn/);expect(upgradeSettlement(blank(),mine[0]).ok).toBe(true)})});

describe('economy',()=>{
  it('upgrades settlement and tracks capex not profit',()=>{const r=upgradeSettlement(blank(),settlement());expect(r.ok).toBe(true);if(r.ok){expect(r.value.building.level).toBe(2);expect(r.value.player.capitalExpenditure).toBe(50);expect(r.value.player.profit).toBe(0);expect(r.value.player.cash).toBe(950)}});
  it('builds and upgrades factory with capacity 1/2/3',()=>{const p=blank();const b=buildFactory(p,settlement(),[]);expect(b.ok).toBe(true);if(!b.ok)return;expect(FACTORY_CAPACITY[b.value.factory.level]).toBe(1);const u=upgradeFactory(b.value.player,b.value.factory);expect(u.ok).toBe(true);if(u.ok)expect(FACTORY_CAPACITY[u.value.factory.level]).toBe(2);const u3=upgradeFactory(u.ok?u.value.player:p,u.ok?u.value.factory:b.value.factory);if(u3.ok)expect(FACTORY_CAPACITY[u3.value.factory.level]).toBe(3)});
  it('produces all six goods without exceeding capacity or stock',()=>{const p=blank();p.products.fabric=4;const goods=['machinery','rail','furniture','flour','fabric','clothing'] as const;for(const g of goods){const r=produce(p,{vertexId:'v1',playerId:0,level:3,usedCapacity:0},g,1);expect(r.ok).toBe(true)}const blocked=produce(p,{vertexId:'v1',playerId:0,level:1,usedCapacity:2},'machinery',1);expect(blocked.ok).toBe(false)});
  it('does not record revenue on production',()=>{const r=produce(blank(),{vertexId:'v1',playerId:0,level:1,usedCapacity:0},'furniture',1);expect(r.ok).toBe(true);if(r.ok){expect(r.value.player.revenue).toBe(0);expect(r.value.player.profit).toBe(0);expect(r.value.player.products.furniture).toBe(1)}});
  it('sells at market price and updates profit via cogs',()=>{const p=blank();p.resources.metal=5;p.inventoryCost.metal=20;const r=sell(p,'metal',2,BASE_RESOURCE_PRICES);expect(r.ok).toBe(true);if(r.ok){expect(r.value.player.cash).toBe(1020);expect(r.value.player.revenue).toBe(20);expect(r.value.player.costs).toBe(8);expect(r.value.player.profit).toBe(12);expect(r.value.player.resources.metal).toBe(3)}});
  it('rejects selling more than owned',()=>expect(sell(blank(),'wood',99,BASE_RESOURCE_PRICES).ok).toBe(false));
  it('fluctuates two resources within 50–200% of base after a completed even round',()=>{const r=fluctuatePrices({...BASE_RESOURCE_PRICES},3,()=>0.5);expect(new Set(r.changes.map(c=>c.resource)).size).toBe(2);for(const res of Object.keys(BASE_RESOURCE_PRICES) as (keyof typeof BASE_RESOURCE_PRICES)[]){expect(r.prices[res]).toBeGreaterThanOrEqual(BASE_RESOURCE_PRICES[res]*0.5);expect(r.prices[res]).toBeLessThanOrEqual(BASE_RESOURCE_PRICES[res]*2)}});
  it('awards lowest sealed bid and earlier tie-break',()=>{const c:Contract={id:'x',name:'t',product:'rail',quantity:2,budget:95,deadlineRound:6,status:'open',bids:[{playerId:1,amount:80,order:1},{playerId:0,amount:80,order:0},{playerId:2,amount:70,order:2}]};const a=awardContract(c);expect(a.ok).toBe(true);if(a.ok){expect(a.value.winnerId).toBe(2);expect(a.value.winningBid).toBe(70)}});
  it('rejects a second bid from the same player',()=>{const c:Contract={id:'x',name:'t',product:'flour',quantity:1,budget:90,deadlineRound:5,status:'open',bids:[]};const first=submitBid(c,0,40);expect(first.ok).toBe(true);if(first.ok)expect(submitBid(first.value,0,30).ok).toBe(false)});
  it('pays only after successful delivery',()=>{const p=blank();p.products.flour=6;const c:Contract={id:'x',name:'t',product:'flour',quantity:6,budget:90,deadlineRound:5,status:'awarded',winnerId:0,winningBid:72,bids:[]};const before=p.cash;const d=deliverContract(p,c,4);expect(d.ok).toBe(true);if(d.ok){expect(d.value.player.cash).toBe(before+72);expect(d.value.player.revenue).toBe(72);expect(d.value.contract.status).toBe('delivered')}});
  it('fails delivery after deadline',()=>{const p=blank();p.products.flour=6;const c:Contract={id:'x',name:'t',product:'flour',quantity:6,budget:90,deadlineRound:5,status:'awarded',winnerId:0,winningBid:72,bids:[]};expect(deliverContract(p,c,6).ok).toBe(false)});
  it('starting cash is not profit',()=>expect(blank().profit).toBe(0));
  it('requires a positive integer profit target',()=>{expect(isValidTargetProfit(5000)).toBe(true);expect(isValidTargetProfit(0)).toBe(false);expect(isValidTargetProfit(-1)).toBe(false);expect(isValidTargetProfit(1.5)).toBe(false)});
  it('wins on cumulative profit not cash',()=>{const rich={...blank(),cash:8000,profit:0};const earner={...blank(),id:1,name:'Earn',cash:200,profit:5000};expect(hasReachedTarget(rich,5000)).toBe(false);expect(winnerByProfit([rich,earner],5000)?.id).toBe(1)});
  it('keeps issuing contracts after round 15',()=>{const a=contractForRound(16),b=contractForRound(1);expect(a.id).not.toBe(b.id);expect(a.deadlineRound).toBeGreaterThan(16);expect(tenderPhase(16)).toBe('ANNOUNCEMENT');expect(tenderPhase(18)).toBe('OPEN BIDDING')});
});

// Setup is now executed on the server; preserve these assertions against its shared rules.
function act(state:GameState,action:GameAction){const result=applyAction(state,action);if(!result.ok)throw new Error(result.error);return result.state}
const setup=()=>act(createWaitingState(),{type:'startMatch',targetProfit:5000,seed:42});
const validVertex=(state:GameState)=>state.board.vertices.find(v=>canPlaceSetupSettlement(state,state.seats[state.turnIndex],v.id).ok)!.id;
describe('setup phase',()=>{
  it('starts with an empty board and free placement does not spend cash',()=>{
    const state=setup();expect(state.phase).toBe('setup');expect(state.buildings).toHaveLength(0);
    const next=act(state,{type:'placeSetupSettlement',playerId:0,vertexId:validVertex(state)});
    expect(next.buildings).toHaveLength(1);expect(next.players.map(p=>p.cash)).toEqual(state.players.map(p=>p.cash));
    expect(next.phase).toBe('setup');expect(applyAction(next,{type:'ROLL_DICE',playerId:1}).ok).toBe(false);expect(next.dice).toBeNull();
  });
  it('advances to the next player after one free settlement',()=>{
    const state=setup(),vertexId=validVertex(state),next=act(state,{type:'placeSetupSettlement',playerId:0,vertexId});
    expect(next.buildings[0]).toMatchObject({vertexId,level:1});expect(next.turnIndex).toBe(1);expect(next.phase).toBe('setup');
  });
  it('finishes setup after four free settlements then allows dice',()=>{
    let state=setup();for(let playerId=0;playerId<4;playerId++)state=act(state,{type:'placeSetupSettlement',playerId,vertexId:validVertex(state)});
    expect(state.phase).toBe('playing');expect(state.buildings).toHaveLength(4);expect(new Set(state.buildings.map(b=>b.playerId)).size).toBe(4);
    state.buildings.forEach(b=>expect(ownedSettlements(b.playerId,state.buildings)).toBe(1));expect(act(state,{type:'ROLL_DICE',playerId:0}).dice).not.toBeNull();
  });
  it('rejects a fourth settlement and does not spend resources',()=>{
    const state=setup();state.phase='playing';state.rolled=true;state.buildings=state.board.vertices.slice(0,3).map(v=>({vertexId:v.id,playerId:0,type:'settlement',level:1}));
    const before=structuredClone(state),result=applyAction(state,{type:'BUILD_SETTLEMENT',playerId:0,vertexId:state.board.vertices[20].id});
    expect(result.ok).toBe(false);if(!result.ok)expect(result.error).toMatch(/giới hạn 3/);expect(state).toEqual(before);
  });
});

describe('shared vertex rendering',()=>{
  it('maps distinct logical vertices to distinct screen positions',()=>{
    const topology=buildTopology(createBoard());
    expect(new Set(topology.vertices.map(v=>v.x.toFixed(6)+','+v.y.toFixed(6))).size).toBe(topology.vertices.length);
  });
});
