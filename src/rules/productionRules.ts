import type {Building,Factory,Player,Resource} from '../types';
import type {GameState,HexCell} from './types';
export type ProductionResult=Record<number,Partial<Record<Resource,number>>>;
/** Factory extraction replaces settlement extraction at the same vertex. */
export function buildingResourceYield(home:Pick<Building,'level'>,factory?:Pick<Factory,'level'>){return factory?factory.level+2:home.level}
export function getActivatedHexes(board:GameState['board'],diceTotal:number):HexCell[]{return diceTotal===7?[]:board.hexes.filter(h=>h.number===diceTotal)}
export function calculateResourceProduction(state:GameState,diceTotal:number):ProductionResult{
 const result:ProductionResult={},active=getActivatedHexes(state.board,diceTotal);if(!active.length)return result;
 const activeIds=new Set(active.map(h=>h.id));
 const seen=new Set<string>();
 for(const b of state.buildings){
  if(seen.has(b.vertexId))continue;
  seen.add(b.vertexId);
  const v=state.board.vertices.find(x=>x.id===b.vertexId);if(!v)continue;
  const factory=state.factories.find(f=>f.vertexId===b.vertexId&&f.playerId===b.playerId);
  const amount=buildingResourceYield(b,factory);
  for(const hid of new Set(v.hexIds)){if(!activeIds.has(hid))continue;const h=active.find(x=>x.id===hid)!;const p=result[b.playerId]??{};p[h.resource]=(p[h.resource]??0)+amount;result[b.playerId]=p}
 }
 return result;
}
export function applyResourceProduction(state:GameState,result:ProductionResult):GameState{
 const players:Player[]=state.players.map(p=>{const gain=result[p.id];if(!gain)return p;const resources={...p.resources};for(const [r,n] of Object.entries(gain))resources[r as Resource]+=(n??0);return{...p,resources}});return{...state,players};
}
