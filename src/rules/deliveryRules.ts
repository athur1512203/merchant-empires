import type {Commodity,Player,Product} from '../types';
import {RETURN_DELIVERED_ON_FAIL,isRawMaterial,penaltyAmount,remainingToDeliver,roundGold,type GameContract} from './economyConfig';
import {auctionBlocksPlay} from './auctionRules';
import type {ActionResult,GameState} from './types';
export function applyVictory(state:GameState):GameState{
  if(state.phase==='finished')return state;
  const winner=state.players.find(p=>p.profit>=state.targetProfit&&state.targetProfit>0);
  return winner?{...state,phase:'finished',winnerId:winner.id}:state;
}
export function creditGold(player:Player,amount:number):Player{
  const paid=Math.min(player.outstandingPenalty,amount);
  return{...player,cash:player.cash+amount-paid,outstandingPenalty:player.outstandingPenalty-paid};
}
function takeGoods(player:Player,product:Commodity,quantity:number){
  const raw=isRawMaterial(product);
  const owned=raw?player.resources[product]:player.products[product as Product],basis=player.inventoryCost[product],cogs=owned?Math.min(basis,roundGold(basis*quantity/owned)):0;
  const stock=raw?{resources:{...player.resources,[product]:owned-quantity}}:{products:{...player.products,[product]:owned-quantity}};
  return{player:{...player,...stock,inventoryCost:{...player.inventoryCost,[product]:basis-cogs}},cogs};
}
export function deliverContract(state:GameState,playerId:number,contractId:string,quantity:number):ActionResult{
  if(state.phase==='finished')return{ok:false,error:'Trận đấu đã kết thúc.'};
  if(state.phase!=='playing')return{ok:false,error:'Trận đấu chưa ở giai đoạn chơi.'};
  if(auctionBlocksPlay(state))return{ok:false,error:'Hãy hoàn tất phiên đấu thầu trước.'};
  if(state.seats[state.turnIndex]!==playerId)return{ok:false,error:'Không thể giao hàng ngoài lượt của bạn.'};
  if(!state.rolled)return{ok:false,error:'Bạn phải gieo xúc xắc trước khi giao hàng.'};
  if(!Number.isFinite(quantity)||!Number.isInteger(quantity)||quantity<=0)return{ok:false,error:'Số lượng giao phải là số nguyên dương hữu hạn.'};
  const index=state.contracts.findIndex(c=>c.id===contractId);if(index<0)return{ok:false,error:'Không tìm thấy hợp đồng.'};
  const contract=state.contracts[index];
  if(contract.winnerId!==playerId)return{ok:false,error:'Bạn không sở hữu hợp đồng này.'};
  if(contract.status==='failed')return{ok:false,error:'Hợp đồng đã hết hạn.'};
  if(contract.status!=='active')return{ok:false,error:'Hợp đồng không còn hiệu lực.'};
  if(state.round>contract.deadlineRound)return{ok:false,error:'Hợp đồng đã quá hạn.'};
  if(quantity>remainingToDeliver(contract))return{ok:false,error:'Không được giao vượt số lượng còn thiếu.'};
  const player=state.players.find(p=>p.id===playerId);if(!player)return{ok:false,error:'Không tìm thấy người chơi.'};
  const owned=isRawMaterial(contract.product)?player.resources[contract.product]:player.products[contract.product as Product];
  if(owned<quantity)return{ok:false,error:isRawMaterial(contract.product)?'Không đủ nguyên liệu để giao.':'Không đủ thành phẩm để giao.'};
  const taken=takeGoods(player,contract.product,quantity);
  // Transfer basis from stock to this contract; recognize it only on completion/failure.
  // Legacy snapshots have no accumulator. Never invent or rewrite past balances.
  const deliveredCost=(contract.deliveredCost??0)+taken.cogs;
  const delivered=contract.delivered+quantity,complete=delivered>=contract.quantity;
  let nextPlayer=taken.player,paid=contract.paid,status:GameContract['status']='active',message=`Đã giao ${quantity} ${contract.product}.`;
  if(complete){
    if(contract.paid)return{ok:false,error:'Hợp đồng đã được thanh toán.'};
    const bid=contract.winningBid??0;
    nextPlayer=creditGold({...taken.player,revenue:taken.player.revenue+bid,costs:taken.player.costs+deliveredCost,profit:taken.player.profit+bid-deliveredCost},bid);
    paid=true;status='completed';message=`Đã giao đủ hợp đồng, nhận ${bid} vàng.`;
  }
  const contracts=[...state.contracts];contracts[index]={...contract,delivered,deliveredCost,paid,status};
  const next=applyVictory({...state,players:state.players.map(p=>p.id===playerId?nextPlayer:p),contracts});
  return{ok:true,message:next.phase==='finished'?`${nextPlayer.name} đã đạt mục tiêu lợi nhuận.`:message,state:next};
}
export function failExpiredContracts(state:GameState,completedRound:number):GameState{
  let players=state.players;
  const contracts=state.contracts.map(contract=>{
    if(contract.status!=='active'||completedRound<contract.deadlineRound||contract.penaltyApplied)return contract;
    // Delivered stock is not returned under the existing configuration. Expense its
    // deferred basis once; only the penalty affects cash/outstanding penalty debt.
    const penalty=penaltyAmount(contract.winningBid??0),lostBasis=contract.deliveredCost??0;
    players=players.map(p=>{
      if(p.id!==contract.winnerId)return p;
      const fromCash=Math.min(p.cash,penalty);
      return{...p,cash:p.cash-fromCash,outstandingPenalty:p.outstandingPenalty+(penalty-fromCash),costs:p.costs+penalty+lostBasis,profit:p.profit-penalty-lostBasis};
    });
    return{...contract,status:'failed' as const,penaltyApplied:true};
  });
  return applyVictory({...state,players,contracts});
}
export{RETURN_DELIVERED_ON_FAIL};
