import {AUCTION_EVERY_ROUNDS,CONTRACTS_PER_AUCTION,DELIVERY_ROUNDS,MIN_BID,TIE_BREAK,generateContract,maxBid,type GameContract} from './economyConfig';
import {mulberry32} from './rng';
import {resetFactoriesForPlayer} from './factoryRules';
import type {ActionResult,AuctionState,GameState} from './types';
export function idleAuction():AuctionState{return{status:'idle',openedAfterRound:null,bidSeat:0,sealedBids:[],skipped:[],lot:null}}
export function auctionBlocksPlay(state:Pick<GameState,'auction'>){return state.auction.status==='open'}
export function shouldOpenAuction(completedRound:number,lastOpened:number|null){return completedRound>0&&completedRound%AUCTION_EVERY_ROUNDS===0&&lastOpened!==completedRound}
export function visibleBids(auction:AuctionState,viewerId:number){return auction.status==='open'?auction.sealedBids.filter(b=>b.playerId===viewerId):auction.sealedBids}
function decided(auction:AuctionState,playerId:number){return auction.skipped.includes(playerId)||auction.sealedBids.some(b=>b.playerId===playerId)}
export function openAuction(state:GameState,completedRound:number):GameState{
  if(state.auction.status==='open'||!shouldOpenAuction(completedRound,state.auction.openedAfterRound))return state;
  const lot=generateContract(mulberry32((state.seed+completedRound*13_331)>>>0),completedRound,CONTRACTS_PER_AUCTION);
  return{...state,turnIndex:0,dice:null,rolled:false,auction:{status:'open',openedAfterRound:completedRound,bidSeat:0,sealedBids:[],skipped:[],lot}};
}
export function closeAuction(state:GameState):ActionResult{
  if(state.phase==='finished')return{ok:false,error:'Trận đấu đã kết thúc.'};
  if(state.auction.status!=='open'||!state.auction.lot)return{ok:false,error:'Không có phiên đấu thầu đang mở.'};
  if(state.auction.sealedBids.length+state.auction.skipped.length<state.seats.length)return{ok:false,error:'Chưa đủ quyết định để đóng phiên.'};
  const valid=[...state.auction.sealedBids].sort((a,b)=>a.amount-b.amount||a.order-b.order);
  const completed=state.auction.openedAfterRound??state.round;
  let lot:GameContract={...state.auction.lot,status:'void'};
  if(valid[0])lot={...lot,status:'active',winnerId:valid[0].playerId,winningBid:valid[0].amount,deadlineRound:completed+DELIVERY_ROUNDS};
  return{ok:true,message:lot.winnerId==null?'Phiên đấu thầu kết thúc, không có giá hợp lệ.':'Đã công bố người trúng thầu.',state:{
    ...state,round:completed+1,turnIndex:0,dice:null,rolled:false,factories:resetFactoriesForPlayer(state.factories,state.seats[0]),
    contracts:[...state.contracts,lot],auction:{...idleAuction(),openedAfterRound:completed}
  }};
}
function finishIfReady(state:GameState):ActionResult{
  if(state.auction.sealedBids.length+state.auction.skipped.length>=state.seats.length)return closeAuction(state);
  const bidSeat=state.auction.bidSeat+1;
  return{ok:true,message:'Đã ghi nhận quyết định đấu thầu.',state:{...state,turnIndex:bidSeat,auction:{...state.auction,bidSeat}}};
}
function auctionActor(state:GameState,playerId:number){
  if(state.phase==='finished')return 'Trận đấu đã kết thúc.';
  if(state.phase!=='playing')return 'Trận đấu chưa ở giai đoạn chơi.';
  if(state.auction.status!=='open')return 'Không có phiên đấu thầu đang mở.';
  if(state.seats[state.auction.bidSeat]!==playerId)return 'Chưa đến lượt gửi giá của bạn.';
  if(decided(state.auction,playerId))return 'Bạn đã gửi quyết định cho phiên này.';
  return null;
}
export function submitBid(state:GameState,playerId:number,amount:number):ActionResult{
  const error=auctionActor(state,playerId);if(error)return{ok:false,error};
  const lot=state.auction.lot!;
  if(!Number.isFinite(amount)||!Number.isInteger(amount)||amount<MIN_BID)return{ok:false,error:'Giá chào phải là số nguyên dương hữu hạn.'};
  if(amount>maxBid(lot.referenceValue))return{ok:false,error:'Giá chào vượt giới hạn tham chiếu.'};
  void TIE_BREAK;
  return finishIfReady({...state,auction:{...state.auction,sealedBids:[...state.auction.sealedBids,{playerId,amount,order:state.auction.sealedBids.length}]}});
}
export function skipBid(state:GameState,playerId:number):ActionResult{
  const error=auctionActor(state,playerId);if(error)return{ok:false,error};
  return finishIfReady({...state,auction:{...state.auction,skipped:[...state.auction.skipped,playerId]}});
}
