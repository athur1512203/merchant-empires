import type {Player,Resource} from '../types';
import type {GameState,HexCell} from './types';
export type ProductionResult=Record<number,Partial<Record<Resource,number>>>;
export function getActivatedHexes(board:GameState['board'],diceTotal:number):HexCell[]{return diceTotal===7?[]:board.hexes.filter(h=>h.number===diceTotal)}
export function calculateResourceProduction(state:GameState,diceTotal:number):ProductionResult{
 const result:ProductionResult={},active=getActivatedHexes(state.board,diceTotal);if(!active.length)return result;
 const activeIds=new Set(active.map(h=>h.id));
 for(const b of state.buildings){const v=state.board.vertices.find(x=>x.id===b.vertexId);if(!v)continue;for(const hid of v.hexIds){if(!activeIds.has(hid))continue;const h=active.find(x=>x.id===hid)!;const p=result[b.playerId]??{};p[h.resource]=(p[h.resource]??0)+b.level;result[b.playerId]=p}}
 return result;
}
export function applyResourceProduction(state:GameState,result:ProductionResult):GameState{
 const players:Player[]=state.players.map(p=>{const gain=result[p.id];if(!gain)return p;const resources={...p.resources};for(const [r,n] of Object.entries(gain))resources[r as Resource]+=(n??0);return{...p,resources}});return{...state,players};
}
