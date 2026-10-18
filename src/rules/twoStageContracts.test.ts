import {describe,it,expect} from 'vitest';
import type {Commodity,Resource} from '../types';
import {applyAction,createCompany,createWaitingState} from './gameState';
import {CONTRACT_CATALOG,RAW_CONTRACT_CATALOG,FINISHED_CONTRACT_CATALOG,generateContract,contractKind,finishedContractsUnlocked,type GameContract} from './economyConfig';
import {openAuction} from './auctionRules';
import {failExpiredContracts,deliverContract} from './deliveryRules';
import type {GameAction,GameState} from './types';
const playing=(over:Partial<GameState>={}):GameState=>({...createWaitingState(),phase:'playing',rolled:true,targetProfit:999999,...over});
const accept=(s:GameState,a:GameAction)=>{const r=applyAction(s,a);expect(r.ok,r.ok?'':r.error).toBe(true);if(!r.ok)throw new Error(r.error);return r.state};
function awarded(item:Commodity='metal',quantity=5,bid=75):GameContract{return{id:'test-'+item,name:'Test',product:item,quantity,referenceValue:104,auctionRound:3,status:'active',winnerId:0,winningBid:bid,deadlineRound:6,delivered:0,deliveredCost:0,paid:false,penaltyApplied:false}}
function stocked(item:Commodity,quantity:number,basis:number){
  const s=playing({round:4,contracts:[awarded(item,quantity)]});
  if(item in s.players[0].resources)s.players[0].resources[item as Resource]=quantity;
  else s.players[0].products[item as keyof typeof s.players[0]['products']]=quantity;
  s.players[0].inventoryCost[item]=basis;return s;
}
const deliver=(s:GameState,n:number)=>accept(s,{type:'DELIVER_CONTRACT',playerId:0,contractId:s.contracts[0].id,quantity:n});
describe('two-stage contract generation',()=>{
  it.each([3,6,9,12,15,18,21,24,27,30])('round %i only samples the four raw contracts',round=>{
    const got=new Set<string>();
    for(let i=0;i<100;i++){const c=generateContract(()=>(i+.5)/100,round,1);got.add(c.product);expect(contractKind(c)).toBe('NGUYÊN LIỆU');expect(c).toMatchObject(RAW_CONTRACT_CATALOG.find(t=>t.product===c.product)!)}
    expect([...got].sort()).toEqual(['cotton','metal','wheat','wood']);
  });
  it.each([33,36,60,99])('round %i includes both raw and all six finished goods',round=>{
    const got=CONTRACT_CATALOG.map((_,i)=>generateContract(()=>(i+.5)/CONTRACT_CATALOG.length,round,1));
    expect(got.map(c=>c.product)).toEqual(CONTRACT_CATALOG.map(c=>c.product));
    expect(new Set(got.map(contractKind))).toEqual(new Set(['NGUYÊN LIỆU','THÀNH PHẨM']));
    expect(FINISHED_CONTRACT_CATALOG).toHaveLength(6);
  });
  it('unlocks at 31 but first eligible auction is after completed round 33',()=>{
    expect(finishedContractsUnlocked(30)).toBe(false);expect(finishedContractsUnlocked(31)).toBe(true);
    for(const round of [31,32])expect(openAuction(playing({round}),round).auction.status).toBe('idle');
    expect(openAuction(playing({round:33}),33).auction.status).toBe('open');
  });
  it('preserves a legacy finished-goods lot even before round 31',()=>{
    const s=openAuction(playing({round:3}),3);
    s.auction.lot={...generateContract(()=>.8,33,1),auctionRound:3};
    delete s.auction.lot.deliveredCost;const before=structuredClone(s);
    expect(openAuction(s,3)).toEqual(before);
    let next=accept(s,{type:'SUBMIT_BID',playerId:0,amount:10});
    for(const id of [1,2,3])next=accept(next,{type:'SKIP_BID',playerId:id});
    expect(next.contracts[0]).toMatchObject({...before.auction.lot,status:'active',winnerId:0,winningBid:10,deadlineRound:6});
    expect(s).toEqual(before);
  });
});
describe('raw inventory and deferred contract accounting',()=>{
  it('rounding across one-unit deliveries conserves every gold of inventory basis',()=>{
    let s=stocked('metal',5,11);
    for(let i=0;i<5;i++){s=deliver(s,1);expect(s.players[0].inventoryCost.metal).toBeGreaterThanOrEqual(0)}
    expect(s.players[0]).toMatchObject({inventoryCost:{metal:0},revenue:75,costs:11,profit:64});
    expect(s.contracts[0].deliveredCost).toBe(11);
  });
  it('completion collects penalty debt without expensing it a second time',()=>{
    const s=stocked('metal',5,0);s.players[0]={...s.players[0],outstandingPenalty:15,costs:15,profit:-15};
    const done=deliver(s,5);
    expect(done.players[0]).toMatchObject({cash:60,outstandingPenalty:0,revenue:75,costs:15,profit:60});
  });

  it.each(RAW_CONTRACT_CATALOG)('fully/partially delivers $product with exact basis and no early revenue',t=>{
    let s=stocked(t.product,t.quantity,7*t.quantity),p=s.players[0];
    s=deliver(s,2);expect(s.players[0]).toMatchObject({cash:0,revenue:0,costs:0,profit:0});
    expect(s.players[0].resources[t.product]).toBe(t.quantity-2);expect(s.players[0].inventoryCost[t.product]).toBe(7*(t.quantity-2));expect(s.contracts[0].deliveredCost).toBe(14);
    s=deliver(s,t.quantity-2);p=s.players[0];
    expect(p.resources[t.product]).toBe(0);expect(p.inventoryCost[t.product]).toBe(0);
    expect(p).toMatchObject({cash:75,revenue:75,costs:t.quantity*7,profit:75-t.quantity*7});
    expect(s.contracts[0]).toMatchObject({status:'completed',paid:true,delivered:t.quantity,deliveredCost:t.quantity*7});
    const before=structuredClone(s);expect(deliverContract(s,0,s.contracts[0].id,1).ok).toBe(false);expect(s).toEqual(before);
  });
  it('self-mined raw materials have zero basis and completion may win the match',()=>{
    const s=stocked('metal',5,0);s.targetProfit=75;
    const partial=deliver(s,4);expect(partial.phase).toBe('playing');expect(partial.players[0].profit).toBe(0);
    const done=deliver(partial,1);expect(done).toMatchObject({phase:'finished',winnerId:0});
    expect(done.players[0]).toMatchObject({cash:75,revenue:75,costs:0,profit:75});
  });
  it('does not reserve undelivered stock; selling it prevents delivery until replenished',()=>{
    let s=stocked('metal',5,55);s=deliver(s,2);
    s=accept(s,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:3});
    expect(s.players[0].resources.metal).toBe(0);expect(s.contracts[0].delivered).toBe(2);
    expect(deliverContract(s,0,s.contracts[0].id,3).ok).toBe(false);
    s.players[0].cash=100;
    s=accept(s,{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:3});s=deliver(s,3);
    expect(s.players[0].costs).toBe(88);expect(s.players[0].revenue).toBe(102);expect(s.players[0].profit).toBe(14);
  });
  it('conserves purchased/mined basis across NPC sales, manufacturing and partial raw delivery',()=>{
    let s=stocked('metal',5,0);s.players[0].cash=200;
    s=accept(s,{type:'BUY_RAW_MATERIAL',playerId:0,resource:'metal',quantity:5});
    s=accept(s,{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:2});
    const vertexId=s.board.vertices[0].id;s.buildings=[{vertexId,playerId:0,type:'settlement',level:2}];s.factories=[{vertexId,playerId:0,level:1,usedCapacity:0}];
    s=accept(s,{type:'MANUFACTURE_GOODS',playerId:0,vertexId,product:'machinery',batches:1});
    expect(s.players[0]).toMatchObject({cash:158,profit:7,costs:11,inventoryCost:{metal:27,machinery:22}});
    s=deliver(s,2);expect(s.contracts[0].deliveredCost).toBe(11);expect(s.players[0].costs).toBe(11);
    s=deliver(s,3);
    expect(s.players[0]).toMatchObject({cash:233,revenue:93,costs:38,profit:55,inventoryCost:{metal:0,machinery:22}});
    // 55 purchase basis + 5 fee = 38 recognized COGS + 22 machinery stock.
    expect(s.players[0].costs+s.players[0].inventoryCost.machinery).toBe(60);
  });
  it('finished-goods partial deliveries include every lot of manufacturing basis',()=>{
    let s=stocked('machinery',3,60);s=deliver(s,1);expect(s.contracts[0].deliveredCost).toBe(20);s=deliver(s,2);
    expect(s.players[0]).toMatchObject({revenue:75,costs:60,profit:15,inventoryCost:{machinery:0}});
  });
  it('failure expenses delivered basis and charges the 20% penalty only once',()=>{
    let s=stocked('metal',5,55);s.players[0].cash=5;s=deliver(s,2);
    const failed=failExpiredContracts(s,6);
    expect(failed.players[0]).toMatchObject({cash:0,revenue:0,costs:37,profit:-37,outstandingPenalty:10,resources:{metal:3},inventoryCost:{metal:33}});
    expect(failed.contracts[0]).toMatchObject({status:'failed',delivered:2,penaltyApplied:true});
    expect(failExpiredContracts(failed,9)).toEqual(failed);
    expect(deliverContract({...failed,round:7},0,s.contracts[0].id,1).ok).toBe(false);
    const collected=accept({...failed,round:7,rolled:true},{type:'SELL_RAW_MATERIAL',playerId:0,resource:'metal',quantity:2});
    expect(collected.players[0]).toMatchObject({cash:8,outstandingPenalty:0,revenue:18,costs:59,profit:-41});
  });
  it.each([0,-1,1.5,NaN,Infinity,6])('rejects invalid/overdelivery quantity %s without mutation',n=>{
    const s=stocked('metal',5,0),before=structuredClone(s);expect(deliverContract(s,0,s.contracts[0].id,n).ok).toBe(false);expect(s).toEqual(before);
  });
  it('rejects shortage, wrong actor, pre-roll, wrong turn, expired and open-auction delivery',()=>{
    const s=stocked('metal',5,0);const variants=[{...s,rolled:false},{...s,turnIndex:1},{...s,round:7},{...s,auction:{...s.auction,status:'open' as const}}];
    for(const state of variants)expect(deliverContract(state,0,s.contracts[0].id,1).ok).toBe(false);
    s.players[0].resources.metal=0;expect(deliverContract(s,0,s.contracts[0].id,1).ok).toBe(false);
    expect(deliverContract(s,3,s.contracts[0].id,1).ok).toBe(false);
  });
  it('legacy finished snapshot without new fields accepts future deliveries without rewriting prior balances',()=>{
    let s=stocked('flour',6,18);delete s.contracts[0].deliveredCost;const before=structuredClone(s);
    const done=deliver(s,6);expect(s).toEqual(before);expect(done.players[0]).toMatchObject({revenue:75,costs:18,profit:57});
  });
});
describe('participant-only sealed tenders',()=>{
  it.each([2,3,4])('%i participants decide, earliest valid equal bid wins',count=>{
    const seats=[3,0,2,1].slice(0,count);
    let s=openAuction(playing({round:3,seats,players:seats.map(createCompany)}),3);
    expect(applyAction(s,{type:'SUBMIT_BID',playerId:seats[0],amount:0}).ok).toBe(false);
    for(const [i,id] of seats.entries()){
      s=accept(s,i<2?{type:'SUBMIT_BID',playerId:id,amount:30}:{type:'SKIP_BID',playerId:id});
      expect(s.auction.status).toBe(i===seats.length-1?'idle':'open');
    }
    expect(s).toMatchObject({round:4,turnIndex:0});expect(s.contracts[0]).toMatchObject({winnerId:3,winningBid:30,deadlineRound:6});
  });
});
