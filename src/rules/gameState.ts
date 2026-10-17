import type {Player} from '../types';
import {generateBoard} from './boardRules';
import {canPlaceSetupSettlement} from './settlementRules';
import {rollDice} from './diceRules';
import {endTurn} from './turnRules';
import {mulberry32} from './rng';
import {REFERENCE_RAW_PRICES,STARTING_GOLD} from './economyConfig';
import {buyRawMaterial,sellRawMaterial} from './marketRules';
import {buildSettlement,upgradeSettlement} from './constructionRules';
import {buildFactory,upgradeFactory} from './factoryRules';
import {manufactureGoods} from './manufacturingRules';
import {closeAuction,idleAuction,skipBid,submitBid} from './auctionRules';
import {deliverContract} from './deliveryRules';
import {COMPANIES,emptyCosts,emptyProducts,emptyResources,type ActionResult,type GameAction,type GameState} from './types';

export function createCompany(id:number):Player{
  const c=COMPANIES[id];
  return{id:c.id,name:c.name,color:c.color,cash:STARTING_GOLD,revenue:0,costs:0,operatingCosts:0,capitalExpenditure:0,loans:0,outstandingPenalty:0,profit:0,resources:emptyResources(),products:emptyProducts(),inventoryCost:emptyCosts()};
}

export function createWaitingState(roomId='local'):GameState{
  return{roomId,seed:0,phase:'waiting',targetProfit:0,round:1,turnIndex:0,seats:[0,1,2,3],players:COMPANIES.map(c=>createCompany(c.id)),board:generateBoard(1),buildings:[],factories:[],winnerId:null,resourcePrices:{...REFERENCE_RAW_PRICES},marketPressure:emptyResources(),auction:idleAuction(),contracts:[],dice:null,rolled:false};
}

export function startMatch(state:GameState,targetProfit:number,seed:number,roomId=state.roomId):ActionResult{
  if(state.phase!=='waiting')return{ok:false,error:'Trận đấu đã bắt đầu.'};
  if(!Number.isInteger(targetProfit)||targetProfit<=0)return{ok:false,error:'Mục tiêu lợi nhuận phải là số nguyên dương.'};
  if(state.players.length!==4)return{ok:false,error:'Cần đúng 4 công ty.'};
  const seats=[0,1,2,3];
  return{ok:true,message:'Giai đoạn đặt khu định cư ban đầu.',state:{
    ...state,roomId,seed,phase:'setup',targetProfit,round:1,turnIndex:0,seats,
    players:COMPANIES.map(c=>createCompany(c.id)),
    board:generateBoard(seed),buildings:[],factories:[],winnerId:null,
    resourcePrices:{...REFERENCE_RAW_PRICES},marketPressure:emptyResources(),auction:idleAuction(),contracts:[],dice:null,rolled:false
  }};
}

export function placeSetupSettlement(state:GameState,playerId:number,vertexId:string):ActionResult{
  const check=canPlaceSetupSettlement(state,playerId,vertexId);
  if(!check.ok)return check;
  const buildings=[...state.buildings,{vertexId,playerId,type:'settlement' as const,level:1 as const}];
  const done=buildings.length>=4;
  return{ok:true,message:done?'Đã đặt đủ 4 khu định cư. Bắt đầu vòng 1.':'Đã đặt khu định cư miễn phí.',state:{
    ...state,buildings,
    phase:done?'playing':'setup',
    round:1,
    turnIndex:done?0:(state.turnIndex+1)%4
    ,dice:null,rolled:false
  }};
}

export function applyAction(state:GameState,action:GameAction):ActionResult{
  if(action.type==='startMatch')return startMatch(state,action.targetProfit,action.seed,action.roomId??state.roomId);
  if(action.type==='placeSetupSettlement')return placeSetupSettlement(state,action.playerId,action.vertexId);
  if(action.type==='ROLL_DICE')return rollDice(state,action.playerId,mulberry32((state.seed+state.round*101+state.turnIndex*17)>>>0));
  if(action.type==='END_TURN')return endTurn(state,action.playerId);
  if(action.type==='BUY_RAW_MATERIAL')return buyRawMaterial(state,action.playerId,action.resource,action.quantity);
  if(action.type==='SELL_RAW_MATERIAL')return sellRawMaterial(state,action.playerId,action.resource,action.quantity);
  if(action.type==='BUILD_SETTLEMENT')return buildSettlement(state,action.playerId,action.vertexId);
  if(action.type==='UPGRADE_SETTLEMENT')return upgradeSettlement(state,action.playerId,action.vertexId);
  if(action.type==='BUILD_FACTORY')return buildFactory(state,action.playerId,action.vertexId);
  if(action.type==='UPGRADE_FACTORY')return upgradeFactory(state,action.playerId,action.vertexId);
  if(action.type==='MANUFACTURE_GOODS')return manufactureGoods(state,action.playerId,action.vertexId,action.product,action.batches);
  if(action.type==='SUBMIT_BID')return submitBid(state,action.playerId,action.amount);
  if(action.type==='SKIP_BID')return skipBid(state,action.playerId);
  if(action.type==='CLOSE_AUCTION')return closeAuction(state);
  if(action.type==='DELIVER_CONTRACT')return deliverContract(state,action.playerId,action.contractId,action.quantity);
  return{ok:false,error:'Hành động không được hỗ trợ.'};
}

export function currentSeat(state:GameState){return state.seats[state.turnIndex]}
