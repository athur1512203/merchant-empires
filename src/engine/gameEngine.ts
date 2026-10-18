import type {Building,Edge,Hex,Player,Resource} from '../types';
import {MAX_SETTLEMENTS_PER_PLAYER} from '../config/economy';
export const BUILD_COST:Record<Resource,number>={metal:1,wood:1,wheat:1,cotton:1};
export const canAfford=(p:Player,cost:Partial<Record<Resource,number>>)=>Object.entries(cost).every(([r,n])=>p.resources[r as Resource]>=(n??0));
export const pay=(p:Player,cost:Partial<Record<Resource,number>>):Player=>({...p,resources:{...p.resources,...Object.fromEntries(Object.entries(p.resources).map(([r,n])=>[r,n-(cost[r as Resource]??0)]))} as Record<Resource,number>});
export function validSettlement(vertexId:string,buildings:Building[],edges:Edge[]){return settlementReason(vertexId,buildings,edges)==null}
export const ownedSettlements=(playerId:number,buildings:Building[])=>buildings.filter(b=>b.playerId===playerId).length;
export function settlementCapReason(playerId:number,buildings:Building[]){
  if(ownedSettlements(playerId,buildings)>=MAX_SETTLEMENTS_PER_PLAYER)return 'Bạn đã đạt giới hạn 4 khu định cư.';
  return null;
}
export function settlementReason(vertexId:string,buildings:Building[],edges:Edge[],playerId?:number){
  if(playerId!=null){const cap=settlementCapReason(playerId,buildings);if(cap)return cap}
  if(buildings.some(b=>b.vertexId===vertexId))return 'Đỉnh này đã có khu định cư.';
  return null;
}
export const setupPlacementOrder=(n=4)=>Array.from({length:n*2},(_,i)=>i%n);
export function shufflePlayers<T>(list:T[],random=Math.random){
  const a=[...list];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
export function distribute(hexes:Hex[],vertices:{id:string;hexIds:string[]}[],buildings:Building[],players:Player[],roll:number){const active=new Set(hexes.filter(h=>h.number===roll).map(h=>h.id));const gains=new Map<number,Partial<Record<Resource,number>>>();for(const b of buildings){const v=vertices.find(x=>x.id===b.vertexId);if(!v)continue;for(const hid of v.hexIds){if(!active.has(hid))continue;const h=hexes.find(x=>x.id===hid)!;const g=gains.get(b.playerId)??{};g[h.resource]=(g[h.resource]??0)+b.level;gains.set(b.playerId,g);}}return players.map(p=>{const g=gains.get(p.id);if(!g)return p;const next={...p.resources};Object.entries(g).forEach(([r,n])=>next[r as Resource]+=(n??0));return{...p,resources:next};});}
export const rollDice=(random=Math.random)=>[Math.floor(random()*6)+1,Math.floor(random()*6)+1] as [number,number];
export const tenderPhase=(round:number)=>['ANNOUNCEMENT','PREPARATION','OPEN BIDDING'][(round-1)%3];
export const applyLoan=(p:Player,amount:number):Player=>({...p,cash:p.cash+amount,loans:p.loans+amount});
export const nextTurn=(turn:number,round:number,playerCount=4)=>{const next=(turn+1)%playerCount;return{turn:next,round:round+(next===0?1:0)}};
