import {MAX_SETTLEMENTS_PER_PLAYER,type GameState} from './types';
import {vertexById} from './boardRules';
import type {Building,Factory} from '../types';

export function ownedSettlements(playerId:number,buildings:Building[]){return buildings.filter(b=>b.playerId===playerId).length}
export function occupying(vertexId:string,buildings:Building[]){return buildings.find(b=>b.vertexId===vertexId)}
export function factoryOn(vertexId:string,factories:Factory[]){return factories.find(f=>f.vertexId===vertexId)}

export function canPlaceSettlement(state:Pick<GameState,'board'|'buildings'>,vertexId:string,playerId:number){
  if(!vertexById(state.board,vertexId))return{ok:false as const,error:'Đỉnh không tồn tại trên bản đồ.'};
  if(occupying(vertexId,state.buildings))return{ok:false as const,error:'Đỉnh này đã có khu định cư.'};
  const neighbors=state.board.adjacency[vertexId]??[];
  if(state.buildings.some(b=>neighbors.includes(b.vertexId)))return{ok:false as const,error:'Hai khu định cư không được nằm ở hai đỉnh liền kề.'};
  if(ownedSettlements(playerId,state.buildings)>=MAX_SETTLEMENTS_PER_PLAYER)return{ok:false as const,error:'Bạn đã đạt giới hạn 3 khu định cư.'};
  return{ok:true as const};
}

export function canBuildFactory(state:Pick<GameState,'buildings'|'factories'>,vertexId:string,playerId:number){
  const b=occupying(vertexId,state.buildings);
  if(!b)return{ok:false as const,error:'Chỉ được xây nhà máy trên khu định cư.'};
  if(b.playerId!==playerId)return{ok:false as const,error:'Bạn không sở hữu khu định cư này.'};
  if(b.level!==2)return{ok:false as const,error:'Khu định cư phải đạt cấp 2 trước khi xây nhà máy.'};
  if(factoryOn(vertexId,state.factories))return{ok:false as const,error:'Mỗi khu định cư tối đa 1 nhà máy.'};
  return{ok:true as const};
}

export function canPlaceSetupSettlement(state:GameState,playerId:number,vertexId:string){
  if(state.phase!=='setup')return{ok:false as const,error:'Không ở giai đoạn đặt khu định cư ban đầu.'};
  const current=state.seats[state.turnIndex];
  if(current!==playerId)return{ok:false as const,error:'Chưa đến lượt đặt khu định cư của bạn.'};
  if(ownedSettlements(playerId,state.buildings)>0)return{ok:false as const,error:'Mỗi công ty chỉ được đặt 1 khu định cư miễn phí.'};
  return canPlaceSettlement(state,vertexId,playerId);
}
