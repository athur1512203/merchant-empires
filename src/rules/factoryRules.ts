import {FACTORY_CAPACITY,FACTORY_COSTS,MAX_FACTORY_LEVEL} from './economyConfig';
import {actingOnTurn,affordability,payCapex} from './constructionRules';
import {canBuildFactory,factoryOn} from './settlementRules';
import type {ActionResult,GameState} from './types';
import type {Factory} from '../types';

export function factoryCapacity(level:Factory['level']){return FACTORY_CAPACITY[level]}
export function remainingCapacity(factory:Factory){return factoryCapacity(factory.level)-factory.usedCapacity}
export function resetFactoriesForPlayer(factories:Factory[],playerId:number){return factories.map(f=>f.playerId===playerId?{...f,usedCapacity:0}:f)}

export function buildFactory(state:GameState,playerId:number,vertexId:string):ActionResult{
  const error=actingOnTurn(state,playerId,'xây nhà máy');
  if(error)return{ok:false,error};
  const place=canBuildFactory(state,vertexId,playerId);
  if(!place.ok)return place;
  const player=state.players.find(p=>p.id===playerId);
  if(!player)return{ok:false,error:'Không tìm thấy người chơi.'};
  const afford=affordability(player,FACTORY_COSTS.build);
  if(afford)return{ok:false,error:afford};
  const next=payCapex(player,FACTORY_COSTS.build);
  const factory:Factory={vertexId,playerId,level:1,usedCapacity:0};
  return{ok:true,message:'Đã xây nhà máy cấp 1.',state:{...state,players:state.players.map(p=>p.id===playerId?next:p),factories:[...state.factories,factory]}};
}

export function upgradeFactory(state:GameState,playerId:number,vertexId:string):ActionResult{
  const error=actingOnTurn(state,playerId,'nâng cấp nhà máy');
  if(error)return{ok:false,error};
  const index=state.factories.findIndex(f=>f.vertexId===vertexId);
  if(index<0)return{ok:false,error:'Không tìm thấy nhà máy.'};
  const factory=state.factories[index];
  if(factory.playerId!==playerId)return{ok:false,error:'Bạn không sở hữu nhà máy này.'};
  const home=state.buildings.find(b=>b.vertexId===vertexId);
  if(!home||home.playerId!==playerId||home.level!==2)return{ok:false,error:'Nhà máy cần khu định cư cấp 2 thuộc sở hữu của bạn.'};
  if(factory.level>=MAX_FACTORY_LEVEL)return{ok:false,error:'Nhà máy đã đạt cấp tối đa.'};
  const nextLevel=(factory.level+1) as 2|3;
  const player=state.players.find(p=>p.id===playerId);
  if(!player)return{ok:false,error:'Không tìm thấy người chơi.'};
  const afford=affordability(player,FACTORY_COSTS.upgrade[nextLevel]);
  if(afford)return{ok:false,error:afford};
  const next=payCapex(player,FACTORY_COSTS.upgrade[nextLevel]);
  const factories=[...state.factories];
  factories[index]={...factory,level:nextLevel};
  return{ok:true,message:`Đã nâng nhà máy lên cấp ${nextLevel}.`,state:{...state,players:state.players.map(p=>p.id===playerId?next:p),factories}};
}
