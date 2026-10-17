import type {ActionResult,GameState} from './types';
import {mulberry32} from './rng';
import {updateMarketPrices} from './marketRules';
import {resetFactoriesForPlayer} from './factoryRules';
import {openAuction} from './auctionRules';
import {failExpiredContracts} from './deliveryRules';
export function getNextPlayer(state:GameState){const turnIndex=(state.turnIndex+1)%state.seats.length;return{turnIndex,playerId:state.seats[turnIndex],round:state.round+(turnIndex===0?1:0)}}
export function canEndTurn(state:GameState,playerId:number){if(state.phase==='finished')return{ok:false as const,error:'Trận đấu đã kết thúc.'};if(state.phase!=='playing')return{ok:false as const,error:'Trận đấu chưa ở giai đoạn chơi.'};if(state.auction.status==='open')return{ok:false as const,error:'Hãy hoàn tất phiên đấu thầu trước.'};if(state.seats[state.turnIndex]!==playerId)return{ok:false as const,error:'Không thể kết thúc lượt của người chơi khác.'};if(!state.rolled)return{ok:false as const,error:'Bạn phải gieo xúc xắc trước khi kết thúc lượt.'};return{ok:true as const}}
export function endTurn(state:GameState,playerId:number):ActionResult{
  const check=canEndTurn(state,playerId);if(!check.ok)return check;
  const n=getNextPlayer(state);
  if(n.turnIndex!==0)return{ok:true,state:{...state,turnIndex:n.turnIndex,dice:null,rolled:false,factories:resetFactoriesForPlayer(state.factories,n.playerId)},message:`Đã chuyển lượt cho ${state.players.find(p=>p.id===n.playerId)?.name??'người chơi tiếp theo'}.`};
  const market=updateMarketPrices(state,mulberry32((state.seed+n.round*7_919)>>>0));
  const afterFail=failExpiredContracts({...state,...market},state.round);
  const afterAuction=openAuction(afterFail,state.round);
  if(afterAuction.auction.status==='open')return{ok:true,state:afterAuction,message:'Phiên đấu thầu kín đã mở. Mỗi công ty gửi giá hoặc bỏ qua.'};
  return{ok:true,state:{...afterAuction,turnIndex:0,round:n.round,dice:null,rolled:false,factories:resetFactoriesForPlayer(afterAuction.factories,afterAuction.seats[0])},message:`Đã chuyển lượt cho ${afterAuction.players.find(p=>p.id===afterAuction.seats[0])?.name??'người chơi tiếp theo'}.`};
}
